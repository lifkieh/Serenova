import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { Logger } from "@/services/logging/logger";
import { rateLimit } from "@/lib/rateLimit";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  buildReflectionContext,
  detectVerbosityPreference,
  validateReflection,
  countRecentSessions,
  fetchReflectionData,
  getWeeklySystemPrompt,
  getMonthlySystemPrompt,
} from "@/services/reflection/generator";

// ─────────────────────────────────────────────────────────────
// Model Clients — lazily initialized singletons
// ─────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  }
  return _anthropic;
}

let _openrouter: OpenAI | null = null;
function getOpenRouterClient(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
  }
  return _openrouter;
}

let _groq: OpenAI | null = null;
function getGroqClient(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY || "",
    });
  }
  return _groq;
}

// ─────────────────────────────────────────────────────────────
// Model Fallback Stack
// ─────────────────────────────────────────────────────────────

const REFLECTION_MODELS = [
  { client: "anthropic" as const, model: "claude-sonnet-4-6" },
  { client: "openrouter" as const, model: "google/gemini-2.5-flash-lite" },
  { client: "openrouter" as const, model: "mistralai/mistral-small-3.2-24b-instruct-2506" },
  { client: "groq" as const, model: "llama-3.3-70b-versatile" },
];

/**
 * Call a single model. Returns the generated text.
 */
async function callModel(
  clientType: "anthropic" | "openrouter" | "groq",
  model: string,
  systemPrompt: string,
  userContext: string
): Promise<string> {
  if (clientType === "anthropic") {
    const anthropic = getAnthropicClient();
    const res = await anthropic.messages.create({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userContext }],
    });
    return (res.content[0] as { type: string; text: string }).text;
  }

  const target = clientType === "groq" ? getGroqClient() : getOpenRouterClient();
  const res = await target.chat.completions.create({
    model,
    max_tokens: 600,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContext },
    ],
  });
  return res.choices[0].message.content ?? "";
}

/**
 * Generate reflection with full fallback stack.
 * - Try each model in order.
 * - If forbidden phrase found, retry ONCE with same model.
 * - If retry also fails validation, move to next model.
 * - If ALL models produce forbidden phrases, return the last result with needs_review=true.
 */
async function generateWithFallback(
  systemPrompt: string,
  userContext: string
): Promise<{ text: string; modelUsed: string; needsReview: boolean }> {
  let lastResult = "";
  let lastModel = "";

  for (const { client, model } of REFLECTION_MODELS) {
    try {
      // First attempt
      const text = await callModel(client, model, systemPrompt, userContext);
      if (validateReflection(text)) {
        return { text, modelUsed: model, needsReview: false };
      }

      // Forbidden phrase detected → retry once with same model
      Logger.warn({
        action: "REFLECTION_FORBIDDEN_PHRASE_RETRY",
        metadata: { model, attempt: 1 },
      });

      const retryText = await callModel(client, model, systemPrompt, userContext);
      if (validateReflection(retryText)) {
        return { text: retryText, modelUsed: model, needsReview: false };
      }

      // Both attempts failed validation → save for fallback comparison
      lastResult = retryText;
      lastModel = model;
      Logger.warn({
        action: "REFLECTION_FORBIDDEN_PHRASE_FALLBACK",
        metadata: { model, reason: "Both attempts contained forbidden phrases" },
      });

    } catch (err: any) {
      Logger.warn({
        action: "REFLECTION_MODEL_FAILED",
        metadata: { model, error: err.message || "Unknown error" },
      });
      continue;
    }
  }

  // All models exhausted — store with needs_review flag
  if (lastResult) {
    return { text: lastResult, modelUsed: lastModel, needsReview: true };
  }

  throw new Error("All reflection models failed");
}

// ─────────────────────────────────────────────────────────────
// POST /api/reflections/generate
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const requestId = Logger.generateRequestId();

  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Rate limit: 3 reflections per hour
    const { allowed } = rateLimit(`reflections:${userId}`, 3, 3_600_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Reflection limit reached. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const type: "weekly" | "monthly" | "manual" = body.type || "weekly";
    const lang: "id" | "en" = body.lang === "id" ? "id" : "en";
    const isManual = type === "manual";

    // Determine date range based on reflection type
    const effectiveType = isManual ? "weekly" : type;
    const dayRange = effectiveType === "monthly" ? 30 : 7;

    // Session threshold check (bypass for manual triggers)
    if (!isManual) {
      const sessionCount = await countRecentSessions(userId, dayRange);
      const threshold = effectiveType === "monthly" ? 10 : 3;

      if (sessionCount < threshold) {
        Logger.info({
          requestId,
          userId,
          action: "REFLECTION_THRESHOLD_NOT_MET",
          metadata: { type: effectiveType, sessionCount, threshold },
        });
        return new Response(null, { status: 204 });
      }
    }

    // Fetch reflection data
    const data = await fetchReflectionData(userId, dayRange);

    // Build context
    const context = buildReflectionContext({
      emotionalMemories: data.emotionalMemories,
      recurringPatterns: data.recurringPatterns,
      chatExcerpts: data.chatExcerpts,
      moodTrends: data.moodTrends,
      emotionalShifts: data.emotionalShifts,
      lang,
      type: effectiveType,
    });

    // Detect verbosity
    const verbosity = detectVerbosityPreference(data.allUserMessages);

    // Build system prompt
    const systemPrompt = effectiveType === "monthly"
      ? getMonthlySystemPrompt(lang, verbosity, context)
      : getWeeklySystemPrompt(lang, verbosity, context);

    // Generate with fallback
    const { text, modelUsed, needsReview } = await generateWithFallback(
      systemPrompt,
      `Generate the ${effectiveType} reflection now.`
    );

    // Persist to Supabase
    const supabase = getSupabase();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - dayRange);

    const { error: insertError } = await supabase.from("reflections").insert([{
      user_id: userId,
      type: effectiveType,
      period_start: periodStart.toISOString(),
      period_end: new Date().toISOString(),
      content: text,
      lang,
      model_used: modelUsed,
      verbosity_preference: verbosity,
      needs_review: needsReview,
    }]);

    if (insertError) {
      Logger.error({
        requestId,
        userId,
        action: "REFLECTION_INSERT_FAILED",
        error: insertError.message,
      });
      return NextResponse.json({ error: `Database insertion failed: ${insertError.message}. Make sure the migrations have been applied to your database.` }, { status: 500 });
    }

    Logger.info({
      requestId,
      userId,
      action: "REFLECTION_GENERATED",
      metadata: { type: effectiveType, lang, modelUsed, needsReview, verbosity },
    });

    return NextResponse.json({
      success: true,
      data: {
        content: text,
        type: effectiveType,
        lang,
        model_used: modelUsed,
        needs_review: needsReview,
        verbosity_preference: verbosity,
      },
    });

  } catch (error: any) {
    Logger.error({
      requestId,
      userId: "unknown",
      action: "REFLECTION_GENERATE_ROUTE_ERROR",
      error: error.message,
    });
    return NextResponse.json({ error: "Failed to generate reflection" }, { status: 500 });
  }
}
