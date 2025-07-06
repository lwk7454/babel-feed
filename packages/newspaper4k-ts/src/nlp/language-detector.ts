import { franc } from 'franc';
import { ArticleConfig } from '../types';
import { LANGUAGE_CONFIGS } from '../config';

/**
 * Detects the language of text content
 */
export class LanguageDetector {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Detect language from text content
   */
  async detect(text: string, metaLanguage?: string): Promise<string> {
    // If meta language is provided and reliable, use it
    if (metaLanguage && this.isReliableMetaLanguage(metaLanguage, text)) {
      return this.normalizeLanguageCode(metaLanguage);
    }

    // If text is too short, fall back to config or meta language
    if (text.length < 50) {
      return metaLanguage 
        ? this.normalizeLanguageCode(metaLanguage)
        : this.config.language || 'en';
    }

    // Use franc library for statistical language detection
    const detectedLang = this.detectWithFranc(text);
    
    // Validate detection result
    if (this.isValidLanguageDetection(detectedLang, text)) {
      return this.normalizeLanguageCode(detectedLang);
    }

    // Fall back to character-based detection for specific languages
    const characterBasedLang = this.detectByCharacterSet(text);
    if (characterBasedLang) {
      return characterBasedLang;
    }

    // Final fallback
    return metaLanguage 
      ? this.normalizeLanguageCode(metaLanguage)
      : this.config.language || 'en';
  }

  /**
   * Check if meta language is reliable
   */
  private isReliableMetaLanguage(metaLanguage: string, text: string): boolean {
    const normalized = this.normalizeLanguageCode(metaLanguage);
    
    // Always trust if text is short
    if (text.length < 100) return true;
    
    // For longer text, do a quick validation
    if (normalized === 'zh' || normalized === 'ja') {
      // Check for appropriate character sets
      const hasAsianChars = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text);
      return hasAsianChars;
    }
    
    if (normalized === 'ar') {
      // Check for Arabic characters
      const hasArabicChars = /[\u0600-\u06ff]/.test(text);
      return hasArabicChars;
    }
    
    if (normalized === 'ru') {
      // Check for Cyrillic characters
      const hasCyrillicChars = /[\u0400-\u04ff]/.test(text);
      return hasCyrillicChars;
    }
    
    // For Latin-based languages, meta is usually reliable
    return true;
  }

  /**
   * Detect language using franc library
   */
  private detectWithFranc(text: string): string {
    try {
      // Use only first 1000 characters for performance
      const sample = text.substring(0, 1000);
      
      // Get top 3 language candidates
      const candidates = franc.all(sample, { minLength: 10 });
      
      if (candidates.length === 0) {
        return 'und'; // Undetermined
      }
      
      // Return the most confident result
      const topCandidate = candidates[0];
      return topCandidate[0]; // Language code
      
    } catch (error) {
      return 'und';
    }
  }

  /**
   * Validate language detection result
   */
  private isValidLanguageDetection(detectedLang: string, text: string): boolean {
    if (!detectedLang || detectedLang === 'und') {
      return false;
    }

    const normalized = this.normalizeLanguageCode(detectedLang);
    
    // Additional validation for specific languages
    switch (normalized) {
      case 'zh':
        // Chinese should have Chinese characters
        return /[\u4e00-\u9fff]/.test(text);
        
      case 'ja':
        // Japanese should have hiragana, katakana, or kanji
        return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(text);
        
      case 'ar':
        // Arabic should have Arabic characters
        return /[\u0600-\u06ff]/.test(text);
        
      case 'ru':
        // Russian should have Cyrillic characters
        return /[\u0400-\u04ff]/.test(text);
        
      case 'ko':
        // Korean should have Hangul characters
        return /[\uac00-\ud7af]/.test(text);
        
      default:
        // For other languages, trust franc's detection
        return true;
    }
  }

  /**
   * Detect language by character set analysis
   */
  private detectByCharacterSet(text: string): string | null {
    const charCounts = this.analyzeCharacterSets(text);
    const totalChars = Object.values(charCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalChars === 0) return null;
    
    // Calculate percentages
    const percentages = Object.entries(charCounts).map(([charset, count]) => ({
      charset,
      percentage: count / totalChars
    }));
    
    // Sort by percentage descending
    percentages.sort((a, b) => b.percentage - a.percentage);
    
    // Determine language based on dominant character set
    const dominant = percentages[0];
    
    if (dominant.percentage > 0.3) { // At least 30% of characters
      switch (dominant.charset) {
        case 'chinese':
          return 'zh';
        case 'japanese':
          return 'ja';
        case 'arabic':
          return 'ar';
        case 'cyrillic':
          return 'ru';
        case 'korean':
          return 'ko';
        case 'thai':
          return 'th';
        case 'hebrew':
          return 'he';
        case 'greek':
          return 'el';
      }
    }
    
    return null;
  }

  /**
   * Analyze character sets in text
   */
  private analyzeCharacterSets(text: string): Record<string, number> {
    const counts = {
      latin: 0,
      chinese: 0,
      japanese: 0,
      arabic: 0,
      cyrillic: 0,
      korean: 0,
      thai: 0,
      hebrew: 0,
      greek: 0
    };
    
    for (const char of text) {
      const code = char.charCodeAt(0);
      
      // Chinese (CJK Unified Ideographs)
      if (code >= 0x4e00 && code <= 0x9fff) {
        counts.chinese++;
      }
      // Japanese Hiragana
      else if (code >= 0x3040 && code <= 0x309f) {
        counts.japanese++;
      }
      // Japanese Katakana
      else if (code >= 0x30a0 && code <= 0x30ff) {
        counts.japanese++;
      }
      // Arabic
      else if (code >= 0x0600 && code <= 0x06ff) {
        counts.arabic++;
      }
      // Cyrillic
      else if (code >= 0x0400 && code <= 0x04ff) {
        counts.cyrillic++;
      }
      // Korean Hangul
      else if (code >= 0xac00 && code <= 0xd7af) {
        counts.korean++;
      }
      // Thai
      else if (code >= 0x0e00 && code <= 0x0e7f) {
        counts.thai++;
      }
      // Hebrew
      else if (code >= 0x0590 && code <= 0x05ff) {
        counts.hebrew++;
      }
      // Greek
      else if (code >= 0x0370 && code <= 0x03ff) {
        counts.greek++;
      }
      // Latin (includes extended Latin)
      else if ((code >= 0x0041 && code <= 0x005a) || 
               (code >= 0x0061 && code <= 0x007a) ||
               (code >= 0x00c0 && code <= 0x024f)) {
        counts.latin++;
      }
    }
    
    return counts;
  }

  /**
   * Normalize language code to standard format
   */
  private normalizeLanguageCode(languageCode: string): string {
    if (!languageCode) return 'en';
    
    // Convert to lowercase and extract primary language
    const primary = languageCode.toLowerCase().split(/[-_]/)[0];
    
    // Map ISO 639-3 codes to ISO 639-1 codes (franc uses ISO 639-3)
    const codeMap: Record<string, string> = {
      // English
      'eng': 'en',
      'en': 'en',
      
      // Chinese
      'cmn': 'zh',
      'zho': 'zh',
      'zh': 'zh',
      'chi': 'zh',
      
      // Japanese
      'jpn': 'ja',
      'ja': 'ja',
      
      // Spanish
      'spa': 'es',
      'es': 'es',
      
      // French
      'fra': 'fr',
      'fre': 'fr',
      'fr': 'fr',
      
      // German
      'deu': 'de',
      'ger': 'de',
      'de': 'de',
      
      // Italian
      'ita': 'it',
      'it': 'it',
      
      // Portuguese
      'por': 'pt',
      'pt': 'pt',
      
      // Russian
      'rus': 'ru',
      'ru': 'ru',
      
      // Arabic
      'ara': 'ar',
      'ar': 'ar',
      
      // Korean
      'kor': 'ko',
      'ko': 'ko',
      
      // Dutch
      'nld': 'nl',
      'dut': 'nl',
      'nl': 'nl',
      
      // Polish
      'pol': 'pl',
      'pl': 'pl',
      
      // Turkish
      'tur': 'tr',
      'tr': 'tr',
      
      // Swedish
      'swe': 'sv',
      'sv': 'sv',
      
      // Norwegian
      'nor': 'no',
      'no': 'no',
      
      // Danish
      'dan': 'da',
      'da': 'da',
      
      // Finnish
      'fin': 'fi',
      'fi': 'fi',
      
      // Greek
      'ell': 'el',
      'gre': 'el',
      'el': 'el',
      
      // Hebrew
      'heb': 'he',
      'he': 'he',
      
      // Thai
      'tha': 'th',
      'th': 'th',
      
      // Vietnamese
      'vie': 'vi',
      'vi': 'vi',
      
      // Indonesian
      'ind': 'id',
      'id': 'id',
      
      // Malay
      'msa': 'ms',
      'may': 'ms',
      'ms': 'ms',
      
      // Hindi
      'hin': 'hi',
      'hi': 'hi',
      
      // Bengali
      'ben': 'bn',
      'bn': 'bn',
      
      // Undetermined
      'und': 'en' // Default to English for undetermined
    };
    
    return codeMap[primary] || primary;
  }

  /**
   * Get confidence score for detected language
   */
  async getConfidence(text: string, detectedLanguage: string): Promise<number> {
    if (text.length < 50) return 0.5; // Low confidence for short text
    
    try {
      const candidates = franc.all(text, { minLength: 10 });
      
      if (candidates.length === 0) return 0.1;
      
      // Find the detected language in candidates
      const normalizedDetected = this.normalizeLanguageCode(detectedLanguage);
      
      for (const [lang, score] of candidates) {
        const normalizedCandidate = this.normalizeLanguageCode(lang);
        if (normalizedCandidate === normalizedDetected) {
          // Convert franc score to 0-1 confidence
          return Math.min(1.0, Math.max(0.1, score / 100));
        }
      }
      
      return 0.1; // Very low confidence if not found in candidates
      
    } catch (error) {
      return 0.1;
    }
  }
}