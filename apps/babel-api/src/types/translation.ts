// Translation API types based on backend contract
export interface TranslationRequest {
  content: string;
  fromLanguage: string;
  toLanguage: string;
  complexity: "simple" | "contextual" | "creative" | "technical";
  contentType: "template_element" | "article_content" | "mixed_content" | "media_captions" | "interactive_element" | "raw_text";
  priority: "urgent" | "high" | "normal" | "low" | "background";
  context?: {
    sourceUrl?: string;
    pageTitle?: string;
    articleTopic?: string;
    culturalContext?: string;
    domainSpecific?: string;
  };
  streaming: boolean;
  requestId: string;
}

export interface StreamingTranslationResult {
  requestId: string;
  translatedContent: string;
  isComplete: boolean;
  confidence: number;
  tokensUsed?: number;
  cacheHit?: boolean;
  qualityScore?: number;
  modelUsed: string;
  backendVersion: string;
  backendProcessingTime: number;
  chunk: number;
  totalChunks: number;
}

export interface TranslationError {
  requestId: string;
  error: {
    code: "UNSUPPORTED_LANGUAGE" | "CONTENT_TOO_LARGE" | "RATE_LIMIT_EXCEEDED" | "MODEL_UNAVAILABLE" | "INTERNAL_ERROR";
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface ModelConfig {
  name: string;
  provider: "openrouter" | "openai" | "anthropic";
  modelId: string;
  maxTokens: number;
  temperature: number;
  targetLatency: number;
  costPer1kTokens: number;
  complexityTypes: Array<"simple" | "contextual" | "creative" | "technical">;
}

export type ComplexityLevel = "simple" | "contextual" | "creative" | "technical";
export type ContentType = "template_element" | "article_content" | "mixed_content" | "media_captions" | "interactive_element" | "raw_text";
export type Priority = "urgent" | "high" | "normal" | "low" | "background";