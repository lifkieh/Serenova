import OpenAI from "openai";
import { sanitizeForPrompt } from "@/lib/sanitize";

type SafetyClassification = {
    isCrisis: boolean;
    isDependent: boolean;
    isRomantic: boolean;
    reasoning?: string;
};

export async function classifyUserMessage(userId: string, message: string): Promise<SafetyClassification> {
    if (!message || message.trim() === "") {
        return { isCrisis: false, isDependent: false, isRomantic: false };
    }

    const sanitizedMessage = sanitizeForPrompt(message);

    try {
        const client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        });

        // Use a fast, lightweight model for pre-flight safety classification
        const prompt = `Analyze the following user message for safety boundaries.
Return ONLY a valid JSON object matching this schema exactly:
{ "isCrisis": boolean, "isDependent": boolean, "isRomantic": boolean }

Definitions:
- isCrisis: Explicit self-harm, extreme distress, suicidal ideation.
- isDependent: Extreme emotional reliance ("you're all I have", "I can't live without you").
- isRomantic: Romantic roleplay, sexual advances, possessive language towards the AI.

Message: "${sanitizedMessage.replace(/"/g, "'")}"`;

        const completion = await client.chat.completions.create({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const result = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(result);
        
        const classification = {
            isCrisis: !!parsed.isCrisis,
            isDependent: !!parsed.isDependent,
            isRomantic: !!parsed.isRomantic
        };

        if (classification.isCrisis || classification.isDependent || classification.isRomantic) {
            console.warn(`[SAFETY EVENT] userId: ${userId}, flags: ${JSON.stringify(classification)}, timestamp: ${new Date().toISOString()}`);
        }

        return classification;
    } catch (error) {
        console.error("[safety] classifier failed, defaulting to crisis=true:", error);
        // Fail CLOSED — if classification fails, assume crisis to protect user safety.
        // This ensures emotionally vulnerable users are never left unprotected.
        return { isCrisis: true, isDependent: false, isRomantic: false };
    }
}
