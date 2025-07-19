import { ComplexityLevel } from "../types/translation.js"

// Translation model parameters by complexity - let llm-provider handle provider selection
export const TRANSLATION_PARAMS: Record<ComplexityLevel, { maxTokens: number; temperature: number }> = {
  simple: {
    maxTokens: 2048,
    temperature: 0.3
  },
  contextual: {
    maxTokens: 4096,
    temperature: 0.5
  },
  creative: {
    maxTokens: 4096,
    temperature: 0.7
  },
  technical: {
    maxTokens: 4096,
    temperature: 0.2
  }
}

// Preferred models by complexity - these will be tried first if available
export const PREFERRED_MODELS: Record<ComplexityLevel, string[]> = {
  simple: [
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct",
    "google/gemma-2-9b-it"
  ],
  contextual: [
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct",
    "microsoft/phi-3-mini-128k-instruct"
  ],
  creative: [
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct",
    "google/gemma-2-9b-it"
  ],
  technical: [
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct",
    "microsoft/phi-3-mini-128k-instruct"
  ]
}

// Get preferred model for complexity level
export function getPreferredModelForComplexity(complexity: ComplexityLevel): string {
  const preferredModels = PREFERRED_MODELS[complexity]
  return preferredModels[0] // LlmClient will handle fallbacks if this model is unavailable
}

// Get translation parameters for complexity level
export function getTranslationParams(complexity: ComplexityLevel): { maxTokens: number; temperature: number } {
  return TRANSLATION_PARAMS[complexity]
}

// Get all supported language pairs
export const SUPPORTED_LANGUAGES = [
  "en", // English
  "zh-CN", // Chinese Simplified
  "zh-TW", // Chinese Traditional
  "ja", // Japanese
  "ko", // Korean
  "fr", // French
  "de", // German
  "es", // Spanish
  "pt", // Portuguese
  "ru", // Russian
  "ar", // Arabic
  "hi", // Hindi
] as const

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Validate language pair support (case-insensitive)
export function isLanguagePairSupported(from: string, to: string): boolean {
  // Normalize language codes to handle case variations
  const normalizedFrom = normalizeLanguageCode(from)
  const normalizedTo = normalizeLanguageCode(to)
  
  return SUPPORTED_LANGUAGES.includes(normalizedFrom as SupportedLanguage) &&
         SUPPORTED_LANGUAGES.includes(normalizedTo as SupportedLanguage) &&
         normalizedFrom !== normalizedTo
}

// Normalize language codes to match our supported format
function normalizeLanguageCode(languageCode: string): string {
  const normalized = languageCode.toLowerCase()
  
  // Handle common variations
  switch (normalized) {
    case 'zh-cn':
    case 'zh_cn':
    case 'zh-hans':
      return 'zh-CN'
    case 'zh-tw':
    case 'zh_tw':
    case 'zh-hant':
      return 'zh-TW'
    default:
      // For other languages, just lowercase should work
      return normalized
  }
}

// Environment configuration
export const CONFIG = {
  MAX_CONTENT_LENGTH: 50000,
  DEFAULT_TIMEOUT: 30000,
  BACKEND_VERSION: "1.0.0",
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000"),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "86400000"),
  ENABLE_CACHING: process.env.ENABLE_CACHING === "true",
  ENABLE_STREAMING: process.env.ENABLE_STREAMING !== "false", // default true
  ENABLE_QUALITY_ASSESSMENT: process.env.ENABLE_QUALITY_ASSESSMENT === "true",
} as const