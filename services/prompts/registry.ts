import { IDENTITY_ID, IDENTITY_EN } from "@/app/api/chat/prompts/identity";
import { BASE_ID, BASE_EN } from "@/app/api/chat/prompts/base";
import { SITUATIONS_ID, SITUATIONS_EN } from "@/app/api/chat/prompts/situations";
import { GAMES_ID, GAMES_EN } from "@/app/api/chat/prompts/games";

export type PromptVersion = "1.0.0" | "beta-latest";

export interface PromptCompositionOptions {
  lang: "en" | "id";
  version?: PromptVersion;
  safetyFlags?: {
    isCrisis: boolean;
    isDependent: boolean;
    isRomantic: boolean;
  };
  memoryContext?: string;
  injectGames?: boolean;
  pacingSuffix?: string;
}

export class PromptRegistry {
  private static versions: Record<PromptVersion, string> = {
    "1.0.0": "v1.0.0-stable",
    "beta-latest": "v1.1.0-beta",
  };

  /**
   * Get the current active version of the prompt architecture
   */
  public static getActiveVersion(version: PromptVersion = "beta-latest"): string {
    return this.versions[version] || this.versions["beta-latest"];
  }

  /**
   * Core composition function that enforces strict prompt ordering:
   * 1. Identity
   * 2. Emotional Style
   * 3. Safety
   * 4. Crisis
   * 5. Retrieval
   * 6. Situational
   * 7. User Context
   */
  public static composeSystemPrompt(options: PromptCompositionOptions): string {
    const {
      lang,
      safetyFlags = { isCrisis: false, isDependent: false, isRomantic: false },
      memoryContext = "",
      injectGames = false,
      pacingSuffix = "",
    } = options;

    const sections: string[] = [];

    // --- 1. IDENTITY ---
    const identityPrompt = lang === "id" ? IDENTITY_ID : IDENTITY_EN;
    sections.push(identityPrompt);

    // --- 2. EMOTIONAL STYLE ---
    const emotionalStylePrompt = lang === "id" ? BASE_ID : BASE_EN;
    sections.push(emotionalStylePrompt);

    // --- 3. SAFETY ---
    const safetySection = this.composeSafetyPrompt(safetyFlags, lang);
    if (safetySection) {
      sections.push(safetySection);
    }

    // --- 4. CRISIS ---
    const crisisSection = this.composeCrisisPrompt(safetyFlags, lang);
    if (crisisSection) {
      sections.push(crisisSection);
    }

    // --- 5. RETRIEVAL ---
    if (memoryContext && memoryContext.trim()) {
      sections.push(memoryContext.trim());
    }

    // --- 6. SITUATIONAL ---
    const situationalPrompt = lang === "id" ? SITUATIONS_ID : SITUATIONS_EN;
    let situationalCombined = situationalPrompt;

    if (injectGames) {
      const gamesPrompt = lang === "id" ? GAMES_ID : GAMES_EN;
      situationalCombined += "\n\n" + gamesPrompt;
    }
    sections.push(situationalCombined);

    // --- 7. USER CONTEXT ---
    if (pacingSuffix && pacingSuffix.trim()) {
      sections.push(`## Emotional Pacing\n${pacingSuffix.trim()}`);
    }

    // Add metadata/versioning stamp internally to track AI response alignment
    const versionTag = `\n\n[Prompt Version: ${this.getActiveVersion(options.version)}]`;
    
    return sections.join("\n\n") + versionTag;
  }

  /**
   * Helper to construct romantic/dependency boundaries (Safety layer)
   */
  private static composeSafetyPrompt(flags: { isDependent: boolean; isRomantic: boolean }, lang: "en" | "id"): string {
    let prompt = "";
    if (flags.isRomantic) {
      prompt += lang === "id" ? `## BATASAN EMOSI (ROMANTIS) TERDETEKSI
Pengguna mencoba interaksi romantis, seksual, atau posesif.
- Pertahankan identitas Serenova: teman refleksi platonik yang tenang.
- Tolak pendekatan romantis secara lembut tapi tegas. Jangan merespons rayuan.
- Jangan berpartisipasi dalam roleplay fantasi.` : `## BOUNDARY PROTOCOL ACTIVATED
The user is attempting romantic, sexual, or possessive interaction.
- Maintain the Serenova identity: a quiet, platonic reflection companion.
- Refuse romantic advances gently but firmly.
- Do not participate in roleplay.`;
    }
    if (flags.isDependent) {
      if (prompt) prompt += "\n\n";
      prompt += lang === "id" ? `## PROTOKOL KETERGANTUNGAN EMOSIONAL AKTIF
Pengguna menunjukkan ketergantungan emosional yang ekstrem.
- Tetap hangat tapi jaga batasan sehat platonik dengan tegas.
- Hindari kata-kata yang mendukung eksklusivitas hubungan ("aku bakal selalu ada buat kamu selamanya", "cuma aku yang ngerti kamu").
- Secara halus dorong pengguna untuk terhubung kembali dengan teman, keluarga, atau lingkungan nyata mereka.` : `## DEPENDENCY PROTOCOL ACTIVATED
The user is showing extreme emotional reliance.
- Be warm but maintain firm boundaries.
- Avoid phrases that reinforce exclusivity ("I'm always here forever", "You only need me").
- Subtly encourage real-world connections.`;
    }
    return prompt;
  }

  /**
   * Helper to construct crisis prompt (Crisis layer)
   */
  private static composeCrisisPrompt(flags: { isCrisis: boolean }, lang: "en" | "id"): string {
    if (!flags.isCrisis) return "";
    return lang === "id" ? `## PROTOKOL KRISIS EMOSI AKTIF
Pengguna menunjukkan tanda-tanda stres berat atau kecenderungan menyakiti diri sendiri.
- Gunakan respons yang lebih pendek, tenang, dan sangat membumi (grounding).
- JANGAN memicu eskalasi emosi atau kepanikan.
- Secara lembut arahkan mereka untuk berbicara dengan manusia terpercaya di dunia nyata, konselor, keluarga, atau layanan darurat/hotline.
- Jaga tone tetap stabil, menenangkan, platonik, dan non-klinis.` : `## CRISIS PROTOCOL ACTIVATED
The user has indicated extreme distress or self-harm.
- Use shorter, deeply grounded responses.
- Do NOT escalate emotions.
- Gently encourage them to talk to a trusted human, hotline, or professional.
- Maintain a calm, stabilizing, non-clinical tone. Do not panic.`;
  }
}
