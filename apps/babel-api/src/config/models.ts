import { ComplexityLevel, ModelConfig } from "../types/translation.js";

// Model configuration based on complexity levels - PAID MODELS WITH LOW LATENCY
export const MODEL_CONFIGS: Record<ComplexityLevel, ModelConfig[]> = {
  simple: [
    {
      name: "Mistral 7B Instruct",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 400,
      costPer1kTokens: 0.0002,
      complexityTypes: ["simple"]
    },
    {
      name: "Llama 3.1 8B Instruct",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 300,
      costPer1kTokens: 0.0001,
      complexityTypes: ["simple"]
    },
    {
      name: "Gemma 2 9B Instruct",
      provider: "openrouter",
      modelId: "google/gemma-2-9b-it",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 350,
      costPer1kTokens: 0.0001,
      complexityTypes: ["simple"]
    }
  ],
  contextual: [
    {
      name: "Mistral 7B Instruct",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 500,
      costPer1kTokens: 0.0002,
      complexityTypes: ["contextual"]
    },
    {
      name: "Llama 3.1 8B Instruct",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 400,
      costPer1kTokens: 0.0001,
      complexityTypes: ["contextual"]
    },
    {
      name: "Phi-3 Mini 128k Instruct",
      provider: "openrouter",
      modelId: "microsoft/phi-3-mini-128k-instruct",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 300,
      costPer1kTokens: 0.0001,
      complexityTypes: ["contextual"]
    }
  ],
  creative: [
    {
      name: "Llama 3.1 8B Instruct",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 400,
      costPer1kTokens: 0.0001,
      complexityTypes: ["creative"]
    },
    {
      name: "Mistral 7B Instruct",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 500,
      costPer1kTokens: 0.0002,
      complexityTypes: ["creative"]
    },
    {
      name: "Gemma 2 9B Instruct",
      provider: "openrouter",
      modelId: "google/gemma-2-9b-it",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 450,
      costPer1kTokens: 0.0001,
      complexityTypes: ["creative"]
    }
  ],
  technical: [
    {
      name: "Llama 3.1 8B Instruct",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 400,
      costPer1kTokens: 0.0001,
      complexityTypes: ["technical"]
    },
    {
      name: "Mistral 7B Instruct",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 500,
      costPer1kTokens: 0.0002,
      complexityTypes: ["technical"]
    },
    {
      name: "Phi-3 Mini 128k Instruct",
      provider: "openrouter",
      modelId: "microsoft/phi-3-mini-128k-instruct",
      maxTokens: 4096,
      temperature: 0.2,  
      targetLatency: 300,
      costPer1kTokens: 0.0001,
      complexityTypes: ["technical"]
    }
  ]
};

// Get optimal model for complexity level with fallback support
export function selectModelForComplexity(complexity: ComplexityLevel): ModelConfig {
  const availableModels = MODEL_CONFIGS[complexity];
  if (!availableModels || availableModels.length === 0) {
    // Fallback to simple models if no specific models available
    return MODEL_CONFIGS.simple[0];
  }
  
  // Select first available model (could be enhanced with load balancing)
  return availableModels[0];
}

// Get fallback model for when primary model fails
export function getFallbackModel(originalComplexity: ComplexityLevel): ModelConfig {
  // Fallback hierarchy: simple -> contextual -> creative -> technical
  const fallbackOrder: ComplexityLevel[] = ["simple", "contextual", "creative", "technical"];
  
  for (const complexity of fallbackOrder) {
    if (complexity !== originalComplexity) {
      const models = MODEL_CONFIGS[complexity];
      if (models && models.length > 0) {
        return models[0];
      }
    }
  }
  
  // Ultimate fallback - return the most reliable simple model
  return MODEL_CONFIGS.simple[0];
}

// Get all free models for load balancing/rotation
export function getAllFreeModels(): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).flat();
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
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Validate language pair support (case-insensitive)
export function isLanguagePairSupported(from: string, to: string): boolean {
  // Normalize language codes to handle case variations
  const normalizedFrom = normalizeLanguageCode(from);
  const normalizedTo = normalizeLanguageCode(to);
  
  return SUPPORTED_LANGUAGES.includes(normalizedFrom as SupportedLanguage) &&
         SUPPORTED_LANGUAGES.includes(normalizedTo as SupportedLanguage) &&
         normalizedFrom !== normalizedTo;
}

// Normalize language codes to match our supported format
function normalizeLanguageCode(languageCode: string): string {
  const normalized = languageCode.toLowerCase();
  
  // Handle common variations
  switch (normalized) {
    case 'zh-cn':
    case 'zh_cn':
    case 'zh-hans':
      return 'zh-CN';
    case 'zh-tw':
    case 'zh_tw':
    case 'zh-hant':
      return 'zh-TW';
    default:
      // For other languages, just lowercase should work
      return normalized;
  }
}

// Environment configuration
export const CONFIG = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  MAX_CONTENT_LENGTH: 50000,
  DEFAULT_TIMEOUT: 30000,
  BACKEND_VERSION: "1.0.0",
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000"),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "86400000"),
  ENABLE_CACHING: process.env.ENABLE_CACHING === "true",
  ENABLE_STREAMING: process.env.ENABLE_STREAMING !== "false", // default true
  ENABLE_QUALITY_ASSESSMENT: process.env.ENABLE_QUALITY_ASSESSMENT === "true",
} as const;