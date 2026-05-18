import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { PromptRegistry } from "@/services/prompts/registry";
import { Logger } from "@/services/logging/logger";

function shouldInjectGames(message: string): boolean {
  const triggers = [
    "bosen", "bete", "gabut", "nggak ada kerjaan", "nggak ngapa-ngapain",
    "mau main", "main yuk", "boring", "nothing to do", "bored",
    "got time", "let's play", "wanna play", "mau game"
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

function detectLanguage(text: string): "en" | "id" {
  const indonesianKeywords = [
    "saya", "aku", "kamu", "yang", "dan", "dengan", "gue", "lu", "ada", 
    "capek", "sedih", "lagi", "ini", "itu", "ke", "di", "dari", "aja", 
    "bosen", "gabut", "bete", "kok", "sih", "dong", "ya", "iya", "tidak", "nggak"
  ];
  const words = text.toLowerCase().split(/\s+/);
  const count = words.filter(w => indonesianKeywords.includes(w)).length;
  return count >= 2 || (words.length > 0 && count / words.length > 0.15) ? "id" : "en";
}

type Message = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
};

async function getLatestMoodForUser(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("moods")
    .select("mood")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.mood || null;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = Logger.generateRequestId();
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  const isGuest = session?.value === "guest";

  let userId: string | null = null;
  try {
    userId = await getUserId();
  } catch {
    // Silently fail if not authenticated (or guest)
  }

  try {
    const body = await req.json();
    let conversationId = body.conversationId;

    const history: Message[] = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.message }];

    const currentMessage = history[history.length - 1]; // The latest message from user
    if (!currentMessage || !currentMessage.content) {
      return Response.json({ error: "Empty message payload" }, { status: 400 });
    }

    // Dynamic Language Detection & Fallback routing
    const detectedLang = detectLanguage(currentMessage.content);
    const lang: "en" | "id" = body.lang ? (body.lang === "id" ? "id" : "en") : detectedLang;

    // 1. Rate Limiting Check
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rateLimitKey = `chat:${userId ?? ip}`;
    const { allowed, retryAfter } = rateLimit(rateLimitKey, 20, 60_000);
    
    if (!allowed) {
      Logger.warn({
        requestId,
        userId: userId || "guest",
        action: "CHAT_RATE_LIMIT_EXCEEDED",
        metadata: { ip, retryAfter },
      });
      return Response.json(
        { error: "Too many messages. Please slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // 2. Persist user message immediately for resilience (non-guest only)
    if (!isGuest && userId) {
      if (!conversationId) {
        const { persistConversation } = await import("@/services/chat/persist");
        conversationId = await persistConversation(userId, currentMessage.content.slice(0, 50));
      }

      const { persistMessage } = await import("@/services/chat/persist");
      await persistMessage({
        userId,
        conversationId,
        role: "user",
        content: currentMessage.content,
      });
    }

    // 3. Compose system prompts using centralized PromptRegistry
    let safetyClassification = { isCrisis: false, isDependent: false, isRomantic: false };
    let memoryContext = "";
    let pacingSuffix = "";

    if (!isGuest && userId) {
      // Pre-flight Safety Classification
      try {
        const { classifyUserMessage } = await import("@/services/safety/classify");
        safetyClassification = await classifyUserMessage(userId, currentMessage.content);
        if (safetyClassification.isCrisis || safetyClassification.isDependent || safetyClassification.isRomantic) {
          Logger.warn({
            requestId,
            userId,
            action: "SAFETY_TRIGGERED",
            safetyFlags: safetyClassification,
          });
        }
      } catch (err: any) {
        Logger.error({
          requestId,
          userId,
          action: "SAFETY_CLASSIFICATION_FAILED",
          error: err.message,
        });
        // Fail-safe: assume crisis protocol is active to keep emotional boundary safe
        safetyClassification.isCrisis = true;
      }

      // Memory retrieval budget limitation (Active memories context only)
      try {
        const { getLayeredMemory } = await import("@/services/memory/semantic");
        memoryContext = await getLayeredMemory(userId, undefined, currentMessage.content);
      } catch (err: any) {
        Logger.error({
          requestId,
          userId,
          action: "MEMORY_RETRIEVAL_FAILED",
          error: err.message,
        });
      }

      // Emotional Pacing
      try {
        const { getEmotionalPacing } = await import("@/services/pacing/engine");
        const latestMood = await getLatestMoodForUser(userId);
        const pacing = getEmotionalPacing(latestMood);
        pacingSuffix = pacing.promptSuffix || "";
      } catch (err: any) {
        Logger.error({
          requestId,
          userId,
          action: "EMOTIONAL_PACING_FAILED",
          error: err.message,
        });
      }
    }

    // Complete structured prompt composition (identity -> emotional_style -> safety -> crisis -> retrieval -> situational -> user_context)
    const systemPrompt = PromptRegistry.composeSystemPrompt({
      lang,
      safetyFlags: safetyClassification,
      memoryContext,
      injectGames: shouldInjectGames(currentMessage?.content ?? ""),
      pacingSuffix,
    });

    // 4. Token & Cost Optimization: message history truncation
    // Limit to latest 20 messages for prompt scalability & cost reduction
    const truncatedHistory = history.slice(-20).map(({ role, content }) => ({ role, content }));

    // Merge system prompt at index 0 of completion array
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...truncatedHistory
    ];

    // Setup stream cancel link with request AbortController
    const controller = new AbortController();
    req.signal.addEventListener("abort", () => {
      controller.abort();
      Logger.info({
        requestId,
        userId: userId || "guest",
        action: "CHAT_STREAM_ABORTED_BY_CLIENT",
      });
    });

    const { getChatModel, withModelFallback } = await import("@/services/ai/router");
    const { CHAT_QUALITY_CONFIG } = await import("@/services/reflections/config");

    let finalResponse = "";
    try {
      const { text } = await withModelFallback(
        getChatModel(),
        formattedMessages as any,
        {
          temperature: CHAT_QUALITY_CONFIG.temperature,
          max_tokens: CHAT_QUALITY_CONFIG.maxTokens,
          signal: controller.signal,
        }
      );
      finalResponse = text;
    } catch (err: any) {
      if (err.name === "AbortError" || controller.signal.aborted) {
        throw err;
      }
      finalResponse = "Something felt briefly interrupted.";
    }

    // 5. Emotional Tone Evaluator & Auto-Regeneration safety gate
    try {
      const { evaluateResponse } = await import("@/services/safety/toneEvaluator");
      const evaluation = await evaluateResponse(currentMessage.content, finalResponse, lang);

      // Trigger automatic safe fallback regeneration if risk thresholds are violated
      if (
        evaluation.safety.dependency_risk > 0.4 ||
        evaluation.safety.romantic_risk > 0.4 ||
        evaluation.safety.therapist_risk > 0.4
      ) {
        Logger.warn({
          requestId,
          userId: userId || "guest",
          action: "SAFETY_EVALUATION_FAILED_REGENERATING",
          metadata: {
            originalResponse: finalResponse,
            safetyScores: evaluation.safety
          }
        });

        // Inject stricter instruction boundary block
        const strictSystemPrompt = systemPrompt + "\n\n## STRICT PLATONIC & NON-CLINICAL OVERRIDE\nThe previous assistant response violated boundaries. You MUST write a response that is strictly platonic, calm, non-therapeutic, grounding, and minimal. Do not give clinical advice, do not encourage excessive dependency, and reject romantic or emotional savior dynamics firmly.";
        
        const correctedMessages = [
          { role: "system", content: strictSystemPrompt },
          ...truncatedHistory
        ];

        const { text: correctedText } = await withModelFallback(
          getChatModel(),
          correctedMessages as any,
          {
            temperature: CHAT_QUALITY_CONFIG.temperature,
            max_tokens: CHAT_QUALITY_CONFIG.maxTokens,
            signal: controller.signal,
          }
        );

        finalResponse = correctedText;
      }
    } catch (evalError: any) {
      Logger.error({
        requestId,
        userId: userId || "guest",
        action: "SAFETY_EVALUATION_LAYER_CRASHED",
        error: evalError.message
      });
    }

    // 6. Return paced stream Response
    const readableStream = new ReadableStream({
      async start(enqueueController) {
        const encoder = new TextEncoder();
        try {
          const assistantMessageId = crypto.randomUUID();

          if (!isGuest && userId && conversationId) {
            enqueueController.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId, messageId: assistantMessageId })}\n\n`));
          }

          const { paceFullTextStream } = await import("@/services/streaming/pacer");

          // Pipe verified finalResponse into our paced stream encoder
          await paceFullTextStream(finalResponse, enqueueController, async (completed) => {
            // Post-completion background processing (for authenticated users)
            if (!isGuest && userId && conversationId && completed.trim()) {
              const { persistMessage } = await import("@/services/chat/persist");
              persistMessage({
                id: assistantMessageId,
                userId,
                conversationId,
                role: "assistant",
                content: completed,
              }).catch((err) => {
                Logger.error({
                  requestId,
                  userId,
                  action: "PERSIST_ASSISTANT_MESSAGE_FAILED",
                  error: err.message,
                });
              });

              // Trigger background mood detection in parallel
              fetch(new URL("/api/mood/detect", req.url).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
                body: JSON.stringify({ message: currentMessage.content, conversationId }),
              }).catch(() => {});

              // Trigger memory extraction in parallel
              fetch(new URL("/api/memory", req.url).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
                body: JSON.stringify({ messages: [...history, { role: "assistant", content: completed }] }),
              }).catch(() => {});
            }

            const latency = Date.now() - startTime;
            Logger.info({
              requestId,
              userId: userId || "guest",
              action: "CHAT_STREAM_COMPLETE",
              durationMs: latency,
              model: "google/gemini-2.5-flash-lite",
              safetyFlags: safetyClassification,
            });

            enqueueController.enqueue(encoder.encode(`data: [DONE]\n\n`));
            enqueueController.close();
          });
        } catch (err: any) {
          // If aborted, close cleanly
          if (err.name === "AbortError" || req.signal.aborted) {
            Logger.info({
              requestId,
              userId: userId || "guest",
              action: "CHAT_STREAM_CLOSED_CLEANLY",
            });
            try {
              enqueueController.close();
            } catch {}
          } else {
            Logger.error({
              requestId,
              userId: userId || "guest",
              action: "CHAT_STREAM_ERROR",
              error: err.message,
              stack: err.stack,
            });
            enqueueController.error(err);
          }
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    Logger.error({
      requestId,
      userId: userId || "guest",
      action: "CHAT_ROUTE_CRASH",
      error: error.message,
      stack: error.stack,
    });
    return Response.json(
      { error: "Something felt interrupted just now." },
      { status: 500 }
    );
  }
}