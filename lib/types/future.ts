/**
 * Future-ready extensibility interfaces.
 * 
 * These are NOT implemented yet — they define the contract
 * for upcoming features so the architecture can grow cleanly.
 * 
 * DO NOT import these in production code yet.
 */

// Voice Journaling — future phase
export interface VoiceJournalEntry {
    id: string;
    userId: string;
    audioUrl: string;
    transcript?: string;
    duration: number; // seconds
    mood?: string;
    createdAt: Date;
}

// Ambient Reflection Mode — future phase
export interface AmbientSession {
    id: string;
    userId: string;
    mode: "breathing" | "listening" | "silence";
    duration: number; // seconds
    startedAt: Date;
    endedAt?: Date;
}

// Exportable Emotional Timeline — future phase
export interface EmotionalTimelineExport {
    userId: string;
    format: "json" | "csv";
    dateRange: { start: Date; end: Date };
    includeJournals: boolean;
    includeMoods: boolean;
    includeReflections: boolean;
    // Never include raw memory embeddings or internal classifications
    excludeInternalData: true;
}

// Local-First Encrypted Memory — future phase
export interface EncryptedMemoryConfig {
    encryptionMethod: "AES-256-GCM";
    keyDerivation: "PBKDF2";
    localStorageKey: string;
    syncEnabled: boolean;
}
