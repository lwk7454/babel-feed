import { OpenAI } from 'openai';
import { TRANSLATION_CONFIG, SUPPORTED_LANGUAGES } from './config.js';

/**
 * Translation service using OpenRouter free models
 */

const openai = new OpenAI({
  baseURL: TRANSLATION_CONFIG.baseUrl,
  apiKey: TRANSLATION_CONFIG.openRouterApiKey,
});

/**
 * Rate limiting to avoid overwhelming free APIs
 */
class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;
  private readonly delayMs = 2000; // 2 second delay between requests

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Translate text using OpenRouter free models
 */
async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  if (fromLang === toLang) {
    return text;
  }

  try {
    const languageNames = {
      'en': 'English',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)', 
      'ja': 'Japanese'
    };

    const prompt = `Translate the following text from ${languageNames[fromLang as keyof typeof languageNames]} to ${languageNames[toLang as keyof typeof languageNames]}. Return only the translation without any additional text or explanation.

Text to translate: "${text}"`;

    const response = await rateLimiter.add(async () => {
      return openai.chat.completions.create({
        model: TRANSLATION_CONFIG.freeModels[0], // Use first available free model
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 512,
        temperature: 0.3,
      });
    });

    const translation = response.choices[0]?.message?.content?.trim();
    if (!translation) {
      throw new Error('Empty translation response');
    }

    return translation;
  } catch (error) {
    console.error(`Translation error (${fromLang} -> ${toLang}):`, error);
    // Return original text if translation fails
    return text;
  }
}

/**
 * Translate content to all supported languages
 */
export async function translateContent(
  text: string,
  sourceLanguage: string
): Promise<Record<string, string>> {
  const translations: Record<string, string> = {};
  
  // Only translate to languages different from source
  const targetLanguages = SUPPORTED_LANGUAGES.filter(lang => lang !== sourceLanguage);
  
  console.log(`Translating "${text.substring(0, 50)}..." from ${sourceLanguage} to ${targetLanguages.join(', ')}`);

  for (const targetLang of targetLanguages) {
    try {
      const translation = await translateText(text, sourceLanguage, targetLang);
      translations[targetLang] = translation;
      console.log(`  ✓ ${targetLang}: "${translation.substring(0, 50)}..."`);
    } catch (error) {
      console.error(`  ✗ Failed to translate to ${targetLang}:`, error);
      // Skip this translation but continue with others
    }
  }

  return translations;
}

/**
 * Batch translate multiple texts
 */
export async function batchTranslateContent(
  texts: string[],
  sourceLanguage: string
): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = [];
  
  for (const text of texts) {
    const translations = await translateContent(text, sourceLanguage);
    results.push(translations);
  }
  
  return results;
}

/**
 * Validate translation configuration
 */
export function validateTranslationConfig(): boolean {
  if (!TRANSLATION_CONFIG.openRouterApiKey) {
    console.error('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
    return false;
  }

  if (TRANSLATION_CONFIG.freeModels.length === 0) {
    console.error('No free models configured for translation.');
    return false;
  }

  return true;
}