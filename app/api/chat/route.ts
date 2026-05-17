import OpenAI from "openai";
import { cookies } from "next/headers";
import { BASE_ID, BASE_EN } from "./prompts/base";
import { SITUATIONS_ID, SITUATIONS_EN } from "./prompts/situations";
import { IDENTITY_ID, IDENTITY_EN } from "./prompts/identity";



const SYSTEM_PROMPT_ID = [BASE_ID, SITUATIONS_ID, IDENTITY_ID].join("\n\n");
const SYSTEM_PROMPT_EN = [BASE_EN, SITUATIONS_EN, IDENTITY_EN].join("\n\n");

type Message = {
  role: "user" | "assistant";
  content: string;
};

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

    const history: Message[] = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.message }];

    const systemPrompt = lang === "id" ? SYSTEM_PROMPT_ID : SYSTEM_PROMPT_EN;

    const completion = await client.chat.completions.create({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
    });

    const response = completion.choices[0].message.content;

    if (!isGuest) {
      console.log("Save messages/memory here later");
    }

    return Response.json({ response });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}