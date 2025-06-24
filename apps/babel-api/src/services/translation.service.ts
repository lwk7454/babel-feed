import { OpenAI } from "openai";
import { 
  TranslationRequest, 
  StreamingTranslationResult, 
  ComplexityLevel,
  BatchedTranslationRequest,
  BatchedTranslationResult,
  BatchedStreamingResult
} from "../types/translation.js";
import { selectModelForComplexity, getFallbackModel, CONFIG, isLanguagePairSupported } from "../config/models.js";

// Helper function to get language name for prompts
function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)', 
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic',
    'hi': 'Hindi'
  };
  return languageNames[code] || code;
}

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
    
    // Use proper language names in the prompt
    const fromLanguageName = getLanguageName(fromLanguage);
    const toLanguageName = getLanguageName(toLanguage);
    
    let prompt = `Translate the following ${fromLanguageName} text to ${toLanguageName}:\n\n"${content}"\n\n`;
    
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
   * Generate batched translation prompt for multiple elements
   */
  private generateBatchedTranslationPrompt(request: BatchedTranslationRequest): string {
    const { elements, fromLanguage, toLanguage, complexity, contentType, context } = request;
    
    const fromLanguageName = getLanguageName(fromLanguage);
    const toLanguageName = getLanguageName(toLanguage);
    
    let prompt = `Translate the following ${fromLanguageName} text elements to ${toLanguageName}. Each element has an ID that must be preserved in the output.\n\n`;
    
    // Add elements to translate
    elements.forEach((element, index) => {
      prompt += `Element ${index + 1} (ID: ${element.id}):\n"${element.text}"\n`;
      if (element.context) {
        if (element.context.beforeText) prompt += `Context before: "${element.context.beforeText}"\n`;
        if (element.context.afterText) prompt += `Context after: "${element.context.afterText}"\n`;
        if (element.context.semanticRole) prompt += `Semantic role: ${element.context.semanticRole}\n`;
      }
      prompt += '\n';
    });
    
    // Add complexity-specific instructions
    switch (complexity) {
      case "simple":
        prompt += "Provide simple, direct translations suitable for UI elements or basic phrases.";
        break;
      case "contextual":
        prompt += "Provide contextually appropriate translations that consider the meaning and context of each element.";
        break;
      case "creative":
        prompt += "Provide creative, culturally adapted translations that capture tone and style.";
        break;
      case "technical":
        prompt += "Provide precise technical translations preserving specialized terminology.";
        break;
    }
    
    // Add content type context
    if (contentType === "template_element") {
      prompt += " These are UI elements, so keep them concise and user-friendly.";
    } else if (contentType === "article_content") {
      prompt += " These are article content elements, so maintain readability and flow.";
    } else if (contentType === "media_captions") {
      prompt += " These are media caption elements, so keep them brief and descriptive.";
    }
    
    // Add additional context if provided
    if (context?.pageTitle) {
      prompt += ` Page context: "${context.pageTitle}".`;
    }
    if (context?.articleTopic) {
      prompt += ` Topic: "${context.articleTopic}".`;
    }
    
    prompt += '\n\nProvide the translations in the following JSON format, maintaining the exact element IDs:\n';
    prompt += '{\n';
    prompt += '  "translations": [\n';
    elements.forEach((element, index) => {
      prompt += `    {"id": "${element.id}", "translatedText": "..."}`;
      if (index < elements.length - 1) prompt += ',';
      prompt += '\n';
    });
    prompt += '  ]\n';
    prompt += '}\n\nProvide only the JSON response without explanations or additional text.';
    
    return prompt;
  }

  /**
   * Stream batched translation from OpenRouter with NDJSON output
   */
  async* streamBatchedTranslation(request: BatchedTranslationRequest): AsyncGenerator<string> {
    const startTime = Date.now();
    
    // Validate language pair
    if (!isLanguagePairSupported(request.fromLanguage, request.toLanguage)) {
      throw new Error(`Unsupported language pair: ${request.fromLanguage} -> ${request.toLanguage}`);
    }
    
    // Validate content
    const totalContentLength = request.elements.reduce((sum, el) => sum + el.text.length, 0);
    if (totalContentLength > CONFIG.MAX_CONTENT_LENGTH) {
      throw new Error(`Content too large: ${totalContentLength} characters (max: ${CONFIG.MAX_CONTENT_LENGTH})`);
    }
    
    const primaryModel = selectModelForComplexity(request.complexity);
    const fallbackModel = getFallbackModel(request.complexity);
    const modelsToTry = [primaryModel];
    
    if (fallbackModel.modelId !== primaryModel.modelId) {
      modelsToTry.push(fallbackModel);
    }
    
    let lastError: Error | null = null;
    
    for (const modelConfig of modelsToTry) {
      try {
        yield* this.attemptBatchedTranslation(request, modelConfig, startTime);
        return;
      } catch (error) {
        console.warn(`Model ${modelConfig.name} failed:`, error);
        lastError = error as Error;
      }
    }
    
    throw lastError || new Error("All translation models failed");
  }

  /**
   * Attempt batched translation with a specific model
   */
  private async* attemptBatchedTranslation(
    request: BatchedTranslationRequest,
    modelConfig: any,
    startTime: number
  ): AsyncGenerator<string> {
    const prompt = this.generateBatchedTranslationPrompt(request);
    
    const stream = await this.openaiClient.chat.completions.create({
      model: modelConfig.modelId,
      messages: [
        {
          role: "system",
          content: "You are a professional translator specializing in accurate, contextually appropriate translations. You must return valid JSON with the exact structure requested, preserving all element IDs."
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
    let processedElements = 0;
    const totalElements = request.elements.length;
    
    // Base confidence for the model
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

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;
      
      if (delta?.content) {
        accumulatedContent += delta.content;
        
        // Try to parse partial JSON to extract completed translations
        try {
          // Look for complete translation objects in the accumulated content
          const completedTranslations = this.extractCompletedTranslations(accumulatedContent, processedElements);
          
          for (const translation of completedTranslations) {
            processedElements++;
            const progress = processedElements / totalElements;
            
            const result: BatchedTranslationResult = {
              id: translation.id,
              translatedText: translation.translatedText,
              confidence: baseConfidence,
              progress: progress,
              isPartial: progress < 1.0
            };
            
            // Yield NDJSON line
            yield JSON.stringify(result) + '\n';
          }
        } catch (e) {
          // Continue if we can't parse yet
        }
      }
      
      if (finishReason === "stop" || finishReason === "length") {
        // Parse final JSON and emit any remaining translations
        try {
          const finalTranslations = JSON.parse(accumulatedContent);
          
          if (finalTranslations.translations) {
            for (const translation of finalTranslations.translations) {
              if (processedElements < totalElements) {
                processedElements++;
                const progress = processedElements / totalElements;
                
                const result: BatchedTranslationResult = {
                  id: translation.id,
                  translatedText: translation.translatedText,
                  confidence: baseConfidence,
                  progress: progress,
                  isPartial: false
                };
                
                yield JSON.stringify(result) + '\n';
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse final translation JSON:", e);
          // Emit fallback results for any missing translations
          for (let i = processedElements; i < totalElements; i++) {
            const element = request.elements[i];
            const result: BatchedTranslationResult = {
              id: element.id,
              translatedText: element.text, // Fallback to original
              confidence: 0.1,
              progress: (i + 1) / totalElements,
              isPartial: false
            };
            yield JSON.stringify(result) + '\n';
          }
        }
        
        // Emit batch completion status
        const batchResult: BatchedStreamingResult = {
          batchId: request.batchId,
          requestId: request.requestId,
          isComplete: true,
          totalElements: totalElements,
          processedElements: processedElements,
          tokensUsed: Math.ceil(accumulatedContent.length / 4),
          modelUsed: modelConfig.name,
          backendVersion: CONFIG.BACKEND_VERSION,
          backendProcessingTime: Date.now() - startTime
        };
        
        yield JSON.stringify(batchResult) + '\n';
        return;
      }
    }
  }

  /**
   * Extract completed translation objects from partial JSON
   */
  private extractCompletedTranslations(partialJson: string, alreadyProcessed: number): Array<{id: string, translatedText: string}> {
    const completedTranslations: Array<{id: string, translatedText: string}> = [];
    
    // Look for completed translation objects in the partial JSON
    // This is a simplified approach - in production, you might want more sophisticated parsing
    const translationPattern = /"id":\s*"([^"]+)",\s*"translatedText":\s*"([^"]+)"/g;
    let match;
    let processedCount = 0;
    
    while ((match = translationPattern.exec(partialJson)) !== null) {
      if (processedCount >= alreadyProcessed) {
        completedTranslations.push({
          id: match[1],
          translatedText: match[2]
        });
      }
      processedCount++;
    }
    
    return completedTranslations.slice(0, Math.max(0, completedTranslations.length - alreadyProcessed));
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