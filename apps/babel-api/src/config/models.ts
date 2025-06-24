import { ComplexityLevel, ModelConfig } from "../types/translation.js";

// Model configuration based on complexity levels - ALL FREE MODELS FROM OPENROUTER
export const MODEL_CONFIGS: Record<ComplexityLevel, ModelConfig[]> = {
  simple: [
    {
      name: "Mistral 7B Instruct Free",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct:free",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 800,
      costPer1kTokens: 0.0,
      complexityTypes: ["simple"]
    },
    {
      name: "Llama 3.1 8B Instruct Free",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct:free",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 600,
      costPer1kTokens: 0.0,
      complexityTypes: ["simple"]
    },
    {
      name: "Gemma 2 9B Instruct Free",
      provider: "openrouter",
      modelId: "google/gemma-2-9b-it:free",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 700,
      costPer1kTokens: 0.0,
      complexityTypes: ["simple"]
    }
  ],
  contextual: [
    {
      name: "Llama 3.3 70B Instruct Free",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.3-70b-instruct:free",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 2000,
      costPer1kTokens: 0.0,
      complexityTypes: ["contextual"]
    },
    {
      name: "Qwen 2.5 72B Instruct Free",
      provider: "openrouter",
      modelId: "qwen/qwen-2.5-72b-instruct:free",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 2200,
      costPer1kTokens: 0.0,
      complexityTypes: ["contextual"]
    },
    {
      name: "DeepSeek R1 Free",
      provider: "openrouter",
      modelId: "deepseek/deepseek-r1:free",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 1800,
      costPer1kTokens: 0.0,
      complexityTypes: ["contextual"]
    }
  ],
  creative: [
    {
      name: "DeepSeek V3 Free",
      provider: "openrouter",
      modelId: "deepseek/deepseek-v3:free",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 2500,
      costPer1kTokens: 0.0,
      complexityTypes: ["creative"]
    },
    {
      name: "Qwen QwQ 32B Free",
      provider: "openrouter",
      modelId: "qwen/qwq-32b-preview:free",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 2000,
      costPer1kTokens: 0.0,
      complexityTypes: ["creative"]
    },
    {
      name: "DeepHermes 3 Llama 3 8B Free",
      provider: "openrouter",
      modelId: "nousresearch/hermes-3-llama-3.1-8b:free",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 1500,
      costPer1kTokens: 0.0,
      complexityTypes: ["creative"]
    }
  ],
  technical: [
    {
      name: "Qwen 2.5 Coder 32B Free",
      provider: "openrouter",
      modelId: "qwen/qwen-2.5-coder-32b-instruct:free",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 2200,
      costPer1kTokens: 0.0,
      complexityTypes: ["technical"]
    },
    {
      name: "DeepSeek Coder V2 Free",
      provider: "openrouter",
      modelId: "deepseek/deepseek-coder:free",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 2000,
      costPer1kTokens: 0.0,
      complexityTypes: ["technical"]
    },
    {
      name: "Llama 3.1 8B Instruct Free (Technical)",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct:free",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 1000,
      costPer1kTokens: 0.0,
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