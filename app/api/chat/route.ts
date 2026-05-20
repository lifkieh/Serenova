import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { PromptRegistry } from "@/services/prompts/registry";
import { Logger } from "@/services/logging/logger";
import { waitUntil } from "@vercel/functions";
import { normalizeAbortReason } from "@/services/streaming/abortReason";
import type { EmotionalPacingState } from "@/services/streaming/pacer";
import { BASE_ID as CHILL_BASE_ID } from "./prompts/base";
import { SITUATIONS_ID as CHILL_SITUATIONS_ID } from "./prompts/situations";
import { IDENTITY_ID as CHILL_IDENTITY_ID } from "./prompts/identity";
import { BASE_EN as CHILL_BASE_EN } from "./prompts/base";
import { SITUATIONS_EN as CHILL_SITUATIONS_EN } from "./prompts/situations";
import { IDENTITY_EN as CHILL_IDENTITY_EN } from "./prompts/identity";

// Indicator texts that must never be persisted as assistant messages
const INDICATOR_TEXTS = new Set([
  "thinking quietly...",
  "mikir dlu kids...",
  "trying to put this into words carefully.",
  "aku lagi nyusun kata-katanya pelan-pelan.",
  "reflecting gently...",
  "connecting a few thoughts...",
  "menghubungkan beberapa hal...",
  "menulis perlahan...",
]);

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
    const saveHistory = body.saveHistory !== false;

    const history: Message[] = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.message }];

    const currentMessage = history[history.length - 1];
    if (!currentMessage || !currentMessage.content) {
      return Response.json({ error: "Empty message payload" }, { status: 400 });
    }

    const detectedLang = detectLanguage(currentMessage.content);
    const lang: "en" | "id" = body.lang ? (body.lang === "id" ? "id" : "en") : detectedLang;

    // Rate limiting
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

    // --- Request-scoped AbortController ---
    const controller = new AbortController();
    req.signal.addEventListener("abort", () => {
      controller.abort(req.signal.reason);
      Logger.info({
        requestId,
        userId: userId || "guest",
        action: "CHAT_STREAM_ABORTED_BY_CLIENT",
      });
    });

    // --- Build and return stream: ALL state is request-scoped inside this closure ---
    const readableStream = new ReadableStream({
      async start(enqueueController) {
        const encoder = new TextEncoder();

        // Request-scoped stream ownership — NO module-level mutable state
        const streamId = crypto.randomUUID();

        // Shared flag: set to true to block all further enqueues
        const streamClosed = { value: false };

        // --- Keepalive interval (request-scoped) ---
        const keepAliveInterval = setInterval(() => {
          if (streamClosed.value || controller.signal.aborted || req.signal.aborted) {
            clearInterval(keepAliveInterval);
            return;
          }
          try {
            enqueueController.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            clearInterval(keepAliveInterval);
          }
        }, 3000);

        // Guard function: every enqueue goes through this
        function safeEnqueue(payload: string) {
          if (streamClosed.value) return;
          if (controller.signal.aborted || req.signal.aborted) return;
          try {
            enqueueController.enqueue(encoder.encode(payload));
          } catch {
            streamClosed.value = true;
          }
        }

        function closeStream() {
          if (streamClosed.value) return;
          streamClosed.value = true;
          clearInterval(keepAliveInterval);
          try { enqueueController.close(); } catch { }
        }

        try {
          // 1. Immediate typing indicator
          const indicatorText = lang === "id" ? "merenung sebentar..." : "thinking quietly...";
          safeEnqueue(`data: ${JSON.stringify({ indicator: indicatorText })}\n\n`);

          // 2. Persist user message (non-guest only)
          if (!isGuest && userId && saveHistory) {
            if (!conversationId) {
              const { persistConversation } = await import("@/services/chat/persist");
              conversationId = await persistConversation(userId, currentMessage.content.slice(0, 50), body.mode || "journal");
            }
            const { persistMessage } = await import("@/services/chat/persist");
            await persistMessage({
              userId,
              conversationId,
              role: "user",
              content: currentMessage.content,
            });
          }

          // Parse optional mode flag for fast responses
          const mode = (body.mode as string) || "standard";
          const isFastMode = mode === "fast";

          // 3. Parallel preflight: safety, memory, mood — all fail-safe
          let safetyClassification = { isCrisis: false, isDependent: false, isRomantic: false };
          let memoryContext = "";
          let pacingSuffix = "";
          let emotionalState: EmotionalPacingState = "default";

          if (!isGuest && userId && !isFastMode && body.mode !== "chill") {
            // Preflight safety & memory must resolve in 3.5 seconds or we bypass them to keep chat responsive
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Preflight timeout")), 3500)
            );

            try {
              const [safetyRes, memoryRes, latestMood] = await Promise.race([
                Promise.all([
                  (async () => {
                    try {
                      const { classifyUserMessage } = await import("@/services/safety/classify");
                      return await classifyUserMessage(userId!, currentMessage.content);
                    } catch { return { isCrisis: false, isDependent: false, isRomantic: false }; }
                  })(),
                  (async () => {
                    try {
                      const { getLayeredMemory } = await import("@/services/memory/semantic");
                      return await getLayeredMemory(userId!, undefined, currentMessage.content);
                    } catch { return ""; }
                  })(),
                  getLatestMoodForUser(userId).catch(() => null),
                ]),
                timeoutPromise
              ]);

              safetyClassification = safetyRes;
              memoryContext = memoryRes;

              try {
                const { getEmotionalPacing } = await import("@/services/pacing/engine");
                const pacing = getEmotionalPacing(latestMood);
                pacingSuffix = pacing.promptSuffix || "";
                const moodMap: Record<string, EmotionalPacingState> = {
                  drained: "drained", overwhelmed: "overwhelmed",
                  restless: "overwhelmed", thoughtful: "thoughtful",
                  lonely: "drained", lighter: "lighter",
                };
                emotionalState = (latestMood && moodMap[latestMood]) || "default";
              } catch { }
            } catch (err) {
              Logger.warn({
                requestId,
                userId: userId || "guest",
                action: "PREFLIGHT_TIMEOUT_TRIGGERED",
                metadata: { message: (err as any).message || "timeout" }
              });
            }
          }

          // 4. Build system prompt
          let systemPrompt = "";
          if (body.mode === "chill") {
            if (lang === "id") {
              systemPrompt = [CHILL_BASE_ID, CHILL_SITUATIONS_ID, CHILL_IDENTITY_ID].join("\n\n");
            } else {
              systemPrompt = [CHILL_BASE_EN, CHILL_SITUATIONS_EN, CHILL_IDENTITY_EN].join("\n\n");
            }
          } else {
            systemPrompt = PromptRegistry.composeSystemPrompt({
              lang,
              safetyFlags: safetyClassification,
              memoryContext,
              injectGames: shouldInjectGames(currentMessage?.content ?? ""),
              pacingSuffix,
            });
          }

          const truncatedHistory = history.slice(-20).map(({ role, content }) => ({ role, content }));
          const formattedMessages = [
            { role: "system", content: systemPrompt },
            ...truncatedHistory
          ];

          const { getChatModel, getChillModel, withModelFallback } = await import("@/services/ai/router");
          const { CHAT_QUALITY_CONFIG } = await import("@/services/reflections/config");

          const modelChain = body.mode === "chill" ? getChillModel() : getChatModel();

          // 5. LLM call with fallback — onFallback invalidates stream ownership
          let finalResponse = "";
          try {
            const { text } = await withModelFallback(
              modelChain,
              formattedMessages as any,
              {
                temperature: CHAT_QUALITY_CONFIG.temperature,
                max_tokens: CHAT_QUALITY_CONFIG.maxTokens,
                signal: controller.signal,
                onFallback: () => {
                  // Terminate old keepalive on rotation; stream itself continues
                  clearInterval(keepAliveInterval);
                },
              }
            );
            finalResponse = text;
          } catch (err: any) {
            clearInterval(keepAliveInterval);
            if (err.name === "AbortError" || controller.signal.aborted) {
              throw err;
            }
            finalResponse = "Something felt briefly interrupted.";
          }

          // Clear keepalive now that we have a response
          clearInterval(keepAliveInterval);

          // 6.5 Image generation interceptor (Chill & Talk mode)
          if (body.mode === "chill" && finalResponse.includes("[IMAGE:")) {
            const regex = /\[IMAGE:\s*(.*?)\]/i;
            const match = finalResponse.match(regex);
            if (match && match[1]) {
              const imagePrompt = match[1].trim();
              try {
                const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
                if (openRouterKey) {
                  let imgUrl = "";

                  // Try images/generations first
                  try {
                    const imageRes = await fetch("https://openrouter.ai/api/v1/images/generations", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openRouterKey}`,
                      },
                      body: JSON.stringify({
                        model: "recraft/recraft-v3",
                        prompt: imagePrompt,
                        size: "1024x1024",
                      }),
                    });
                    const imageData = await imageRes.json();
                    if (imageData.data?.[0]?.url) {
                      imgUrl = imageData.data[0].url;
                    }
                  } catch (e) {
                    console.error("images/generations endpoint error, trying chat/completions fallback", e);
                  }

                  // Try chat/completions as fallback
                  if (!imgUrl) {
                    const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openRouterKey}`,
                      },
                      body: JSON.stringify({
                        model: "recraft/recraft-v3",
                        messages: [{ role: "user", content: imagePrompt }],
                      }),
                    });
                    const chatData = await chatRes.json();
                    if (chatData.choices?.[0]?.message?.content) {
                      const content = chatData.choices[0].message.content.trim();
                      if (content.startsWith("http")) {
                        imgUrl = content;
                      }
                    }
                  }

                  if (imgUrl) {
                    finalResponse = finalResponse.replace(regex, `\n\n![${imagePrompt}](${imgUrl})\n\n`);
                  } else {
                    throw new Error("No image URL received from API");
                  }
                }
              } catch (imageErr) {
                console.error("Failed to generate image via recraft-v3:", imageErr);
                finalResponse = finalResponse.replace(regex, lang === "id"
                  ? "\n\n*(Aduh bro, server gambar gua lagi ngadat nih. Nanti coba lagi ya!)*\n\n"
                  : "\n\n*(Ah bro, my image generator is acting up right now. Try again later!)*\n\n"
                );
              }
            }
          }

          // 6. Tone evaluator safety gate (skip for chill mode)
          if (body.mode !== "chill") {
            try {
              const { evaluateResponse } = await import("@/services/safety/toneEvaluator");
              const evaluation = await evaluateResponse(currentMessage.content, finalResponse, lang);

              if (
                evaluation.safety.dependency_risk > 0.4 ||
                evaluation.safety.romantic_risk > 0.4 ||
                evaluation.safety.therapist_risk > 0.4
              ) {
                Logger.warn({
                  requestId,
                  userId: userId || "guest",
                  action: "SAFETY_EVALUATION_FAILED_REGENERATING",
                  metadata: { safetyScores: evaluation.safety },
                });

                const strictSystemPrompt = systemPrompt +
                  "\n\n## STRICT PLATONIC & NON-CLINICAL OVERRIDE\nThe previous response violated boundaries. " +
                  "Write a response that is strictly platonic, calm, non-therapeutic, grounding, and minimal. " +
                  "No clinical advice, no dependency encouragement, no romantic dynamics.";

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
                    onFallback: () => { clearInterval(keepAliveInterval); },
                  }
                );
                finalResponse = correctedText;
              }
            } catch (evalError: any) {
              Logger.error({
                requestId,
                userId: userId || "guest",
                action: "SAFETY_EVALUATION_LAYER_CRASHED",
                error: evalError.message,
              });
            }
          }

          // 7. Emit metadata before streaming text
          const assistantMessageId = crypto.randomUUID();
          if (!isGuest && userId && conversationId) {
            safeEnqueue(`data: ${JSON.stringify({ conversationId, messageId: assistantMessageId })}\n\n`);
          }

          // 8. Semantic persistence gate
          //    Only persist if stream completed a meaningful, non-indicator response
          const { paceFullTextStream } = await import("@/services/streaming/pacer");

          let streamCompletedCleanly = false;

          await paceFullTextStream(
            finalResponse,
            enqueueController,
            (completed: string) => {
              clearInterval(keepAliveInterval);

              const abortReason = normalizeAbortReason(req.signal.reason);

              const hasMeaningfulOutput =
                completed.trim().length > 0 &&
                !INDICATOR_TEXTS.has(completed.trim());

              const shouldPersist =
                hasMeaningfulOutput &&
                !isGuest &&
                !!userId &&
                !!conversationId &&
                saveHistory &&
                abortReason !== "navigation_abort" &&
                abortReason !== "manual_abort";

              if (shouldPersist) {
                waitUntil(
                  Promise.allSettled([
                    (async () => {
                      const { persistMessage } = await import("@/services/chat/persist");
                      return persistMessage({
                        id: assistantMessageId,
                        userId: userId!,
                        conversationId: conversationId!,
                        role: "assistant",
                        content: completed,
                      });
                    })(),
                    fetch(new URL("/api/mood/detect", req.url).toString(), {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
                      body: JSON.stringify({ message: currentMessage.content, conversationId }),
                    }),
                    fetch(new URL("/api/memory", req.url).toString(), {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
                      body: JSON.stringify({ messages: [...history, { role: "assistant", content: completed }] }),
                    }),
                  ]).then((results) => {
                    // Goal 3: log task failures without emitting user content
                    const taskNames = ["persist_message", "mood_detect", "memory_extract"];
                    results.forEach((result, i) => {
                      if (result.status === "rejected") {
                        Logger.error({
                          requestId,
                          userId: userId || "guest",
                          action: "BACKGROUND_TASK_FAILED",
                          metadata: {
                            task: taskNames[i],
                            streamId,
                            reason: (result.reason as any)?.message ?? "unknown",
                          },
                        });
                      }
                    });
                  })
                );
              }

              streamCompletedCleanly = true;
              const latency = Date.now() - startTime;
              Logger.info({
                requestId,
                userId: userId || "guest",
                action: "CHAT_STREAM_COMPLETE",
                durationMs: latency,
                metadata: { streamId, shouldPersist },
              });

              safeEnqueue(`data: [DONE]\n\n`);
              closeStream();
            },
            streamClosed,
            controller.signal,
            emotionalState,
            lang
          );

          if (!streamCompletedCleanly) {
            closeStream();
          }

        } catch (err: any) {
          streamClosed.value = true;
          clearInterval(keepAliveInterval);

          if (err.name === "AbortError" || req.signal.aborted) {
            Logger.info({
              requestId,
              userId: userId || "guest",
              action: "CHAT_STREAM_CLOSED_CLEANLY",
              metadata: { streamId, reason: normalizeAbortReason(req.signal.reason) },
            });
            try { enqueueController.close(); } catch { }
          } else {
            Logger.error({
              requestId,
              userId: userId || "guest",
              action: "CHAT_STREAM_ERROR",
              error: err.message,
              metadata: { streamId },
            });
            try {
              enqueueController.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
              enqueueController.close();
            } catch { }
          }
        } finally {
          clearInterval(keepAliveInterval);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    Logger.error({
      requestId,
      userId: userId || "guest",
      action: "CHAT_ROUTE_CRASHED",
      error: (error as any).message,
    });
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}