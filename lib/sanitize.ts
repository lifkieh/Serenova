export function sanitizeForPrompt(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, "[code block]")   // strip code blocks
    .replace(/#{1,6}\s/g, "")                       // strip markdown headers
    .replace(/\[.*?\]\(.*?\)/g, "[link]")           // strip markdown links
    .slice(0, 2000)                                  // hard cap 2000 chars
    .trim();
}
