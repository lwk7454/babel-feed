import { OpenAI } from "openai";
import { TranslationRequest, StreamingTranslationResult, ComplexityLevel } from "../types/translation.js";
import { selectModelForComplexity, getFallbackModel, CONFIG, isLanguagePairSupported } from "../config/models.js";

export class TranslationService {
  private openaiClient: OpenAI;
  
  constructor() {
    // Configure OpenAI client for OpenRouter - USING ONLY FREE MODELS
    this.openaiClient = new OpenAI({
      apiKey: CONFIG.OPENROUTER_API_KEY,
      baseURL: CONFIG.OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://babel-feed.com",
        "X-Title": "Babel Feed Translation - Free Models Only",
      },
    });
  }

  /**
   * Generate translation prompt based on request context
   */
  private generateTranslationPrompt(request: TranslationRequest): string {
    const { content, fromLanguage, toLanguage, complexity, contentType, context } = request;
    
    let prompt = `Translate the following ${fromLanguage} text to ${toLanguage}:\n\n"${content}"\n\n`;
    
    // Add complexity-specific instructions
    switch (complexity) {
      case "simple":
        prompt += "Provide a simple, direct translation suitable for UI elements or basic phrases.";
        break;
      case "contextual":
        prompt += "Provide a contextually appropriate translation that considers the meaning and context.";
        break;
      case "creative":
        prompt += "Provide a creative, culturally adapted translation that captures tone and style.";
        break;
      case "technical":
        prompt += "Provide a precise technical translation preserving specialized terminology.";
        break;
    }
    
    // Add content type context
    if (contentType === "template_element") {
      prompt += " This is a UI element, so keep it concise and user-friendly.";
    } else if (contentType === "article_content") {
      prompt += " This is article content, so maintain readability and flow.";
    } else if (contentType === "media_captions") {
      prompt += " This is media caption text, so keep it brief and descriptive.";
    }
    
    // Add additional context if provided
    if (context?.pageTitle) {
      prompt += ` Page context: "${context.pageTitle}".`;
    }
    if (context?.articleTopic) {
      prompt += ` Topic: "${context.articleTopic}".`;
    }
    if (context?.culturalContext) {
      prompt += ` Cultural context: ${context.culturalContext}.`;
    }
    if (context?.domainSpecific) {
      prompt += ` Domain: ${context.domainSpecific}.`;
    }
    
    prompt += "\n\nProvide only the translation without explanations or additional text.";
    
    return prompt;
  }

  /**
   * Estimate translation quality based on various factors
   */
  private calculateQualityScore(
    translatedText: string,
    originalText: string,
    confidence: number,
    complexity: ComplexityLevel
  ): number {
    let baseScore = confidence;
    
    // Adjust based on length ratio (translations should be reasonably similar in length)
    const lengthRatio = translatedText.length / originalText.length;
    if (lengthRatio < 0.3 || lengthRatio > 3.0) {
      baseScore *= 0.8; // Penalize very different lengths
    }
    
    // Adjust based on complexity
    switch (complexity) {
      case "simple":
        baseScore *= 1.0; // No adjustment for simple translations
        break;
      case "contextual":
        baseScore *= 0.95; // Slightly lower confidence for contextual
        break;
      case "creative":
        baseScore *= 0.9; // Lower confidence for creative translations
        break;
      case "technical":
        baseScore *= 0.92; // Technical translations need precision
        break;
    }
    
    return Math.max(0.0, Math.min(1.0, baseScore));
  }

  /**
   * Stream translation from OpenRouter with fallback support
   */
  async* streamTranslation(request: TranslationRequest): AsyncGenerator<StreamingTranslationResult> {
    const startTime = Date.now();
    
    // Validate language pair
    if (!isLanguagePairSupported(request.fromLanguage, request.toLanguage)) {
      throw new Error(`Unsupported language pair: ${request.fromLanguage} -> ${request.toLanguage}`);
    }
    
    // Validate content length
    if (request.content.length > CONFIG.MAX_CONTENT_LENGTH) {
      throw new Error(`Content too large: ${request.content.length} characters (max: ${CONFIG.MAX_CONTENT_LENGTH})`);
    }
    
    // Try primary model first, then fallback if needed
    const primaryModel = selectModelForComplexity(request.complexity);
    const fallbackModel = getFallbackModel(request.complexity);
    const modelsToTry = [primaryModel];
    
    // Add fallback model if different from primary
    if (fallbackModel.modelId !== primaryModel.modelId) {
      modelsToTry.push(fallbackModel);
    }
    
    let lastError: Error | null = null;
    
    for (const modelConfig of modelsToTry) {
      try {
        yield* this.attemptTranslation(request, modelConfig, startTime);
        return; // Success, exit the loop
      } catch (error) {
        console.warn(`Model ${modelConfig.name} failed:`, error);
        lastError = error as Error;
        // Continue to next model
      }
    }
    
    // All models failed, throw the last error
    throw lastError || new Error("All translation models failed");
  }

  /**
   * Attempt translation with a specific model
   */
  private async* attemptTranslation(
    request: TranslationRequest, 
    modelConfig: any, 
    startTime: number
  ): AsyncGenerator<StreamingTranslationResult> {
    const prompt = this.generateTranslationPrompt(request);
    
    const stream = await this.openaiClient.chat.completions.create({
      model: modelConfig.modelId,
      messages: [
        {
          role: "system",
          content: "You are a professional translator specializing in accurate, contextually appropriate translations. Focus on preserving meaning and cultural nuances."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
      stream: true,
    });

    let accumulatedContent = "";
    let chunkNumber = 0;
    let totalTokens = 0;
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;
      
      if (delta?.content) {
        accumulatedContent += delta.content;
        chunkNumber++;
        
        // Estimate token count (rough approximation)
        totalTokens = Math.ceil(accumulatedContent.length / 4);
        
        const processingTime = Date.now() - startTime;
        
        // Calculate confidence based on free model capabilities
        const baseConfidence = modelConfig.name.includes("DeepSeek V3") ? 0.92 : 
                             modelConfig.name.includes("Llama 3.3 70B") ? 0.90 :
                             modelConfig.name.includes("Qwen 2.5 72B") ? 0.89 :
                             modelConfig.name.includes("DeepSeek R1") ? 0.91 :
                             modelConfig.name.includes("Qwen QwQ 32B") ? 0.87 :
                             modelConfig.name.includes("Qwen 2.5 Coder") ? 0.88 :
                             modelConfig.name.includes("DeepHermes 3") ? 0.86 :
                             modelConfig.name.includes("Llama 3.1 8B") ? 0.84 :
                             modelConfig.name.includes("Mistral 7B") ? 0.83 :
                             modelConfig.name.includes("Gemma 2 9B") ? 0.82 : 0.80;
        
        const confidence = this.calculateQualityScore(
          accumulatedContent,
          request.content,
          baseConfidence,
          request.complexity
        );
        
        const result: StreamingTranslationResult = {
          requestId: request.requestId,
          translatedContent: accumulatedContent,
          isComplete: false, // Will be set to true in the final chunk
          confidence: parseFloat(confidence.toFixed(3)),
          tokensUsed: totalTokens,
          cacheHit: false, // TODO: Implement caching
          qualityScore: confidence,
          modelUsed: modelConfig.name,
          backendVersion: CONFIG.BACKEND_VERSION,
          backendProcessingTime: processingTime,
          chunk: chunkNumber,
          totalChunks: -1, // -1 indicates unknown total
        };
        
        yield result;
      }
      
      // Handle stream completion
      if (finishReason === "stop" || finishReason === "length") {
        // Send final completion chunk
        const processingTime = Date.now() - startTime;
        
        // Calculate final confidence
        const baseConfidence = modelConfig.name.includes("DeepSeek V3") ? 0.92 : 
                             modelConfig.name.includes("Llama 3.3 70B") ? 0.90 :
                             modelConfig.name.includes("Qwen 2.5 72B") ? 0.89 :
                             modelConfig.name.includes("DeepSeek R1") ? 0.91 :
                             modelConfig.name.includes("Qwen QwQ 32B") ? 0.87 :
                             modelConfig.name.includes("Qwen 2.5 Coder") ? 0.88 :
                             modelConfig.name.includes("DeepHermes 3") ? 0.86 :
                             modelConfig.name.includes("Llama 3.1 8B") ? 0.84 :
                             modelConfig.name.includes("Mistral 7B") ? 0.83 :
                             modelConfig.name.includes("Gemma 2 9B") ? 0.82 : 0.80;
        
        const confidence = this.calculateQualityScore(
          accumulatedContent || request.content,
          request.content,
          baseConfidence,
          request.complexity
        );
        
        const finalResult: StreamingTranslationResult = {
          requestId: request.requestId,
          translatedContent: accumulatedContent || request.content, // Fallback if no content
          isComplete: true,
          confidence: parseFloat(confidence.toFixed(3)),
          tokensUsed: totalTokens || 1,
          cacheHit: false,
          qualityScore: confidence,
          modelUsed: modelConfig.name,
          backendVersion: CONFIG.BACKEND_VERSION,
          backendProcessingTime: processingTime,
          chunk: chunkNumber || 1,
          totalChunks: chunkNumber || 1,
        };
        
        yield finalResult;
        return;
      }
    }
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to list models
      if (!CONFIG.OPENROUTER_API_KEY) {
        return false;
      }
      
      // Could add a simple API call to verify connectivity
      return true;
    } catch (error) {
      console.error("Service availability check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const translationService = new TranslationService();