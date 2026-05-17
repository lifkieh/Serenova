import OpenAI from "openai";
import { cookies } from "next/headers";
import { BASE_ID, BASE_EN } from "./prompts/base";
import { SITUATIONS_ID, SITUATIONS_EN } from "./prompts/situations";
import { IDENTITY_ID, IDENTITY_EN } from "./prompts/identity";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

const SYSTEM_PROMPT_ID = [BASE_ID, SITUATIONS_ID, IDENTITY_ID].join("\n\n");
const SYSTEM_PROMPT_EN = [BASE_EN, SITUATIONS_EN, IDENTITY_EN].join("\n\n");

type Message = {
  role: "user" | "assistant";
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
  try {

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    const isGuest = session?.value === "guest";

    const body = await req.json();

    const lang: "en" | "id" = body.lang === "id" ? "id" : "en";
    let conversationId = body.conversationId;

    const history: Message[] = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.message }];

    const currentMessage = history[history.length - 1]; // The latest message from user

    let systemPrompt = lang === "id" ? SYSTEM_PROMPT_ID : SYSTEM_PROMPT_EN;
    const userId = await getUserId();

    if (!isGuest && userId) {
      // Create conversation if it doesn't exist
      if (!conversationId) {
        const { persistConversation } = await import("@/services/chat/persist");
        conversationId = await persistConversation(userId, currentMessage.content.slice(0, 50));
      }

      // Persist user message
      const { persistMessage } = await import("@/services/chat/persist");
      await persistMessage({
        userId,
        conversationId,
        role: "user",
        content: currentMessage.content,
      });

      // Safety Classification (Pre-flight)
      const { classifyUserMessage } = await import("@/services/safety/classify");
      const { getSafetySystemInjection } = await import("@/services/safety/boundaries");
      const safetyClassification = await classifyUserMessage(currentMessage.content);
      const safetyPrompt = getSafetySystemInjection(safetyClassification);
      if (safetyPrompt) {
          systemPrompt += "\n\n" + safetyPrompt;
      }

      // Layered Memory Injection (SQL + semantic when available)
      const { getLayeredMemory } = await import("@/services/memory/semantic");
      const memContext = await getLayeredMemory(userId, undefined, currentMessage.content);
      if (memContext) {
          systemPrompt += memContext;
      }

      // Emotional Pacing
      const { getEmotionalPacing } = await import("@/services/pacing/engine");
      const latestMood = await getLatestMoodForUser(userId);
      const pacing = getEmotionalPacing(latestMood);
      if (pacing.promptSuffix) {
          systemPrompt += "\n\n## Emotional Pacing\n" + pacing.promptSuffix;
      }
    }

    const stream = await client.chat.completions.create({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      stream: true,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          if (!isGuest && userId && conversationId) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`));
          }

          const { createPacedStream } = await import("@/services/streaming/pacer");
          let fullResponse = "";

          await createPacedStream(stream, controller, (completed) => {
            fullResponse = completed;
          });
          
          if (!isGuest && userId && conversationId) {
            const { persistMessage } = await import("@/services/chat/persist");
            persistMessage({
              userId,
              conversationId,
              role: "assistant",
              content: fullResponse,
            }).catch(console.error);

            // Background Mood Detection
            fetch(new URL("/api/mood/detect", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
              body: JSON.stringify({ message: currentMessage.content, conversationId }),
            }).catch(console.error);

            // Background Memory Extraction + Decay
            fetch(new URL("/api/memory", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, messages: [...history, { role: "assistant", content: fullResponse }] }),
            }).catch(console.error);
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
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

  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}