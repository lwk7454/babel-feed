import { OpenAI } from "openai";
import { TranslationRequest, StreamingTranslationResult, ComplexityLevel } from "../types/translation.js";
import { selectModelForComplexity, CONFIG, isLanguagePairSupported } from "../config/models.js";

export class TranslationService {
  private openaiClient: OpenAI;
  
  constructor() {
    // Configure OpenAI client for OpenRouter
    this.openaiClient = new OpenAI({
      apiKey: CONFIG.OPENROUTER_API_KEY,
      baseURL: CONFIG.OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://babel-feed.com",
        "X-Title": "Babel Feed Translation",
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
   * Stream translation from OpenRouter
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
    
    // Select model based on complexity
    const modelConfig = selectModelForComplexity(request.complexity);
    const prompt = this.generateTranslationPrompt(request);
    
    try {
      const stream = await this.openaiClient.chat.completions.create({
        model: modelConfig.modelId,
        messages: [
          {
            role: "system",
            content: "You are a professional translator. Provide accurate, contextually appropriate translations."
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
          
          const isComplete = finishReason === "stop" || finishReason === "length";
          const processingTime = Date.now() - startTime;
          
          // Calculate confidence based on model and content
          const baseConfidence = modelConfig.name.includes("GPT-4") ? 0.95 : 
                               modelConfig.name.includes("Claude") ? 0.92 :
                               modelConfig.name.includes("LLaMA") ? 0.88 : 0.85;
          
          const confidence = this.calculateQualityScore(
            accumulatedContent,
            request.content,
            baseConfidence,
            request.complexity
          );
          
          const result: StreamingTranslationResult = {
            requestId: request.requestId,
            translatedContent: accumulatedContent,
            isComplete,
            confidence: parseFloat(confidence.toFixed(3)),
            tokensUsed: totalTokens,
            cacheHit: false, // TODO: Implement caching
            qualityScore: confidence,
            modelUsed: modelConfig.name,
            backendVersion: CONFIG.BACKEND_VERSION,
            backendProcessingTime: processingTime,
            chunk: chunkNumber,
            totalChunks: isComplete ? chunkNumber : -1, // -1 indicates unknown total
          };
          
          yield result;
          
          if (isComplete) {
            break;
          }
        }
        
        // Handle completion without content (edge case)
        if (finishReason === "stop" && accumulatedContent === "") {
          const result: StreamingTranslationResult = {
            requestId: request.requestId,
            translatedContent: request.content, // Fallback to original content
            isComplete: true,
            confidence: 0.1,
            tokensUsed: 1,
            cacheHit: false,
            qualityScore: 0.1,
            modelUsed: modelConfig.name,
            backendVersion: CONFIG.BACKEND_VERSION,
            backendProcessingTime: Date.now() - startTime,
            chunk: 1,
            totalChunks: 1,
          };
          
          yield result;
          break;
        }
      }
      
    } catch (error) {
      console.error("Translation error:", error);
      
      // Provide fallback result
      const fallbackResult: StreamingTranslationResult = {
        requestId: request.requestId,
        translatedContent: request.content, // Return original content as fallback
        isComplete: true,
        confidence: 0.0,
        tokensUsed: 0,
        cacheHit: false,
        qualityScore: 0.0,
        modelUsed: "fallback",
        backendVersion: CONFIG.BACKEND_VERSION,
        backendProcessingTime: Date.now() - startTime,
        chunk: 1,
        totalChunks: 1,
      };
      
      yield fallbackResult;
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