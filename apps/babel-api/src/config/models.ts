import { ComplexityLevel, ModelConfig } from "../types/translation.js";

// Model configuration based on complexity levels
export const MODEL_CONFIGS: Record<ComplexityLevel, ModelConfig[]> = {
  simple: [
    {
      name: "WizardLM-2-7B",
      provider: "openrouter",
      modelId: "microsoft/wizardlm-2-7b",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 500,
      costPer1kTokens: 0.0007,
      complexityTypes: ["simple"]
    },
    {
      name: "Qwen2-7B-Instruct",
      provider: "openrouter", 
      modelId: "qwen/qwen-2-7b-instruct",
      maxTokens: 2048,
      temperature: 0.3,
      targetLatency: 600,
      costPer1kTokens: 0.0009,
      complexityTypes: ["simple"]
    }
  ],
  contextual: [
    {
      name: "LLaMA-3.1-8B-Instruct",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 2000,
      costPer1kTokens: 0.0015,
      complexityTypes: ["contextual"]
    },
    {
      name: "Mistral-7B-Instruct",
      provider: "openrouter",
      modelId: "mistralai/mistral-7b-instruct:free",
      maxTokens: 4096,
      temperature: 0.5,
      targetLatency: 1800,
      costPer1kTokens: 0.0,
      complexityTypes: ["contextual"]
    }
  ],
  creative: [
    {
      name: "Claude-3-Haiku",
      provider: "openrouter",
      modelId: "anthropic/claude-3-haiku",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 3000,
      costPer1kTokens: 0.0025,
      complexityTypes: ["creative"]
    },
    {
      name: "GPT-4o-mini",
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      maxTokens: 4096,
      temperature: 0.7,
      targetLatency: 2500,
      costPer1kTokens: 0.0015,
      complexityTypes: ["creative"]
    },
    {
      name: "LLaMA-3.1-70B",
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1-70b-instruct",
      maxTokens: 8192,
      temperature: 0.7,
      targetLatency: 5000,
      costPer1kTokens: 0.0059,
      complexityTypes: ["creative"]
    }
  ],
  technical: [
    {
      name: "CodeLLaMA-34B-Instruct",
      provider: "openrouter",
      modelId: "codellama/codellama-34b-instruct",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 3000,
      costPer1kTokens: 0.0035,
      complexityTypes: ["technical"]
    },
    {
      name: "Deepseek-Coder-33B",
      provider: "openrouter",
      modelId: "deepseek/deepseek-coder-33b-instruct",
      maxTokens: 4096,
      temperature: 0.2,
      targetLatency: 2800,
      costPer1kTokens: 0.0027,
      complexityTypes: ["technical"]
    }
  ]
};

// Get optimal model for complexity level
export function selectModelForComplexity(complexity: ComplexityLevel): ModelConfig {
  const availableModels = MODEL_CONFIGS[complexity];
  if (!availableModels || availableModels.length === 0) {
    // Fallback to simple models if no specific models available
    return MODEL_CONFIGS.simple[0];
  }
  
  // Select first available model (could be enhanced with load balancing)
  return availableModels[0];
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

// Validate language pair support
export function isLanguagePairSupported(from: string, to: string): boolean {
  return SUPPORTED_LANGUAGES.includes(from as SupportedLanguage) &&
         SUPPORTED_LANGUAGES.includes(to as SupportedLanguage) &&
         from !== to;
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