/**
 * Reflection and Conversational Quality Configurations
 * Calibrated specifically for quiet, emotionally resonant, non-gamified journaling.
 */

export interface QualityConfig {
  temperature: number;
  maxTokens: number;
  emotionalDepth: "lightweight" | "moderate" | "profound";
  pacingIntervalMs: number;
  pacingParagraphIntervalMs: number;
}

export const CHAT_QUALITY_CONFIG: QualityConfig = {
  temperature: 0.35,
  maxTokens: 500,
  emotionalDepth: "lightweight",
  pacingIntervalMs: 140, // Standard serene pacing delay per punctuation
  pacingParagraphIntervalMs: 200,
};

export const WEEKLY_REFLECTION_QUALITY_CONFIG: QualityConfig = {
  temperature: 0.4,
  maxTokens: 800,
  emotionalDepth: "moderate",
  pacingIntervalMs: 180, // Slightly more lingering pacing for weekly summaries
  pacingParagraphIntervalMs: 300,
};

export const MONTHLY_REFLECTION_QUALITY_CONFIG: QualityConfig = {
  temperature: 0.3,
  maxTokens: 1200,
  emotionalDepth: "profound",
  pacingIntervalMs: 220, // Lingering, profound breathing pacing for monthly checkpoints
  pacingParagraphIntervalMs: 400,
};
