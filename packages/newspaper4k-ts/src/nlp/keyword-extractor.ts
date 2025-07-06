import { removeStopwords } from 'stopword';
import { ArticleConfig } from '../types';
import { LANGUAGE_CONFIGS } from '../config';
import { TextUtils } from '../utils/text-utils';

/**
 * Extracts keywords from text using frequency analysis and NLP techniques
 */
export class KeywordExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract keywords from text
   */
  async extract(text: string, language: string = 'en'): Promise<string[]> {
    if (!text || text.length < 50) {
      return [];
    }

    // Tokenize text
    const tokens = this.tokenize(text, language);
    
    // Remove stopwords
    const filteredTokens = this.removeStopwords(tokens, language);
    
    // Calculate word frequencies
    const wordFreqs = this.calculateWordFrequencies(filteredTokens);
    
    // Calculate TF-IDF-like scores
    const scoredWords = this.scoreWords(wordFreqs, text, language);
    
    // Extract phrases (bigrams/trigrams)
    const phrases = this.extractPhrases(text, language);
    
    // Combine words and phrases
    const allCandidates = [...scoredWords, ...phrases];
    
    // Sort and filter
    const keywords = this.selectKeywords(allCandidates);
    
    return keywords;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string, language: string): string[] {
    // Clean text first
    let cleaned = text.toLowerCase();
    
    // Handle different languages
    if (language === 'zh') {
      // For Chinese, we need character-based segmentation
      // This is a simplified approach - in production, use proper Chinese segmentation
      return this.segmentChinese(cleaned);
    } else if (language === 'ja') {
      // For Japanese, similar character-based approach
      // In production, use proper Japanese segmentation like TinySegmenter
      return this.segmentJapanese(cleaned);
    }
    
    // For Latin-based languages
    return this.segmentLatin(cleaned);
  }

  /**
   * Segment Chinese text
   */
  private segmentChinese(text: string): string[] {
    // Very basic Chinese segmentation
    // In production, use a proper library like nodejieba
    const words: string[] = [];
    let currentWord = '';
    
    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        // Chinese character
        if (currentWord && !/[\u4e00-\u9fff]/.test(currentWord[currentWord.length - 1])) {
          words.push(currentWord);
          currentWord = '';
        }
        currentWord += char;
        // For now, treat each character as a word (very basic)
        if (currentWord.length >= 2) {
          words.push(currentWord);
          currentWord = '';
        }
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // Latin character
        if (currentWord && /[\u4e00-\u9fff]/.test(currentWord[currentWord.length - 1])) {
          words.push(currentWord);
          currentWord = '';
        }
        currentWord += char;
      } else {
        // Separator
        if (currentWord) {
          words.push(currentWord);
          currentWord = '';
        }
      }
    }
    
    if (currentWord) {
      words.push(currentWord);
    }
    
    return words.filter(word => word.length > 1);
  }

  /**
   * Segment Japanese text
   */
  private segmentJapanese(text: string): string[] {
    // Very basic Japanese segmentation
    // In production, use TinySegmenter or similar
    const words: string[] = [];
    let currentWord = '';
    
    for (const char of text) {
      if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(char)) {
        // Japanese character (Hiragana, Katakana, Kanji)
        currentWord += char;
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // Latin character
        currentWord += char;
      } else {
        // Separator
        if (currentWord && currentWord.length > 1) {
          words.push(currentWord);
        }
        currentWord = '';
      }
    }
    
    if (currentWord && currentWord.length > 1) {
      words.push(currentWord);
    }
    
    // Basic segmentation by character type changes
    const segmented: string[] = [];
    for (const word of words) {
      if (word.length > 3) {
        // Break long words at character type boundaries
        let current = '';
        let lastType = '';
        
        for (const char of word) {
          let type = '';
          if (/[\u3040-\u309f]/.test(char)) type = 'hiragana';
          else if (/[\u30a0-\u30ff]/.test(char)) type = 'katakana';
          else if (/[\u4e00-\u9fff]/.test(char)) type = 'kanji';
          else type = 'other';
          
          if (lastType && lastType !== type && current.length > 1) {
            segmented.push(current);
            current = char;
          } else {
            current += char;
          }
          lastType = type;
        }
        
        if (current.length > 1) {
          segmented.push(current);
        }
      } else {
        segmented.push(word);
      }
    }
    
    return segmented;
  }

  /**
   * Segment Latin-based text
   */
  private segmentLatin(text: string): string[] {
    // Remove punctuation and split on whitespace
    const words = text
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 50)
      .filter(word => !/^\d+$/.test(word)); // Remove pure numbers
    
    return words;
  }

  /**
   * Remove stopwords for given language
   */
  private removeStopwords(tokens: string[], language: string): string[] {
    // Use stopword library for common languages
    const supportedLangs = ['en', 'zh', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'ko'];
    
    if (supportedLangs.includes(language)) {
      try {
        return removeStopwords(tokens, language as any);
      } catch (error) {
        // Fallback to English stopwords
        return removeStopwords(tokens, 'en' as any);
      }
    }
    
    // Use custom stopwords from config
    const langConfig = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    if (langConfig) {
      const stopwords = new Set(langConfig.stopwords);
      return tokens.filter(token => !stopwords.has(token.toLowerCase()));
    }
    
    // Fallback to English
    return removeStopwords(tokens, 'en' as any);
  }

  /**
   * Calculate word frequencies
   */
  private calculateWordFrequencies(tokens: string[]): Map<string, number> {
    const freqs = new Map<string, number>();
    
    for (const token of tokens) {
      const normalized = token.toLowerCase();
      freqs.set(normalized, (freqs.get(normalized) || 0) + 1);
    }
    
    return freqs;
  }

  /**
   * Score words using TF-IDF-like algorithm
   */
  private scoreWords(
    wordFreqs: Map<string, number>, 
    text: string, 
    language: string
  ): Array<{ word: string; score: number }> {
    const totalWords = Array.from(wordFreqs.values()).reduce((sum, count) => sum + count, 0);
    const textLength = text.length;
    
    const scored: Array<{ word: string; score: number }> = [];
    
    for (const [word, freq] of wordFreqs.entries()) {
      // Term frequency
      const tf = freq / totalWords;
      
      // Length bonus (prefer longer words)
      const lengthBonus = Math.min(word.length / 10, 2);
      
      // Position bonus (words appearing early get bonus)
      const firstPos = text.toLowerCase().indexOf(word);
      const positionBonus = firstPos < textLength * 0.3 ? 1.5 : 1;
      
      // Frequency bonus (but not too high to avoid overfitting)
      const freqBonus = Math.min(Math.log(freq + 1), 3);
      
      // Capitalization bonus (from original text)
      const capBonus = this.hasCapitalization(word, text) ? 1.2 : 1;
      
      // Calculate final score
      const score = tf * lengthBonus * positionBonus * freqBonus * capBonus;
      
      scored.push({ word, score });
    }
    
    return scored;
  }

  /**
   * Check if word appears capitalized in original text
   */
  private hasCapitalization(word: string, text: string): boolean {
    const capitalizedPattern = new RegExp(`\\b${word.charAt(0).toUpperCase()}${word.slice(1)}\\b`, 'i');
    return capitalizedPattern.test(text);
  }

  /**
   * Extract meaningful phrases (bigrams and trigrams)
   */
  private extractPhrases(text: string, language: string): Array<{ word: string; score: number }> {
    const phrases: Array<{ word: string; score: number }> = [];
    
    // For CJK languages, phrase extraction is different
    if (language === 'zh' || language === 'ja') {
      return this.extractCJKPhrases(text);
    }
    
    // For Latin-based languages
    const sentences = TextUtils.splitSentences(text);
    
    for (const sentence of sentences) {
      const tokens = this.segmentLatin(sentence);
      const filteredTokens = this.removeStopwords(tokens, language);
      
      // Extract bigrams
      for (let i = 0; i < filteredTokens.length - 1; i++) {
        const bigram = `${filteredTokens[i]} ${filteredTokens[i + 1]}`;
        if (bigram.length > 5 && bigram.length < 50) {
          const score = this.scorePhrases(bigram, text);
          phrases.push({ word: bigram, score });
        }
      }
      
      // Extract trigrams
      for (let i = 0; i < filteredTokens.length - 2; i++) {
        const trigram = `${filteredTokens[i]} ${filteredTokens[i + 1]} ${filteredTokens[i + 2]}`;
        if (trigram.length > 8 && trigram.length < 80) {
          const score = this.scorePhrases(trigram, text);
          phrases.push({ word: trigram, score });
        }
      }
    }
    
    return phrases;
  }

  /**
   * Extract phrases for CJK languages
   */
  private extractCJKPhrases(text: string): Array<{ word: string; score: number }> {
    const phrases: Array<{ word: string; score: number }> = [];
    
    // Simple approach: extract consecutive character sequences
    const chars = Array.from(text);
    
    for (let i = 0; i < chars.length - 1; i++) {
      // 2-character phrases
      const bigram = chars.slice(i, i + 2).join('');
      if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{2}/.test(bigram)) {
        const score = this.scorePhrases(bigram, text);
        phrases.push({ word: bigram, score });
      }
      
      // 3-character phrases
      if (i < chars.length - 2) {
        const trigram = chars.slice(i, i + 3).join('');
        if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{3}/.test(trigram)) {
          const score = this.scorePhrases(trigram, text);
          phrases.push({ word: trigram, score });
        }
      }
    }
    
    return phrases;
  }

  /**
   * Score phrases
   */
  private scorePhrases(phrase: string, text: string): number {
    // Count occurrences
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    const frequency = matches ? matches.length : 0;
    
    // Base score on frequency and length
    const freqScore = Math.min(frequency * 2, 10);
    const lengthScore = Math.min(phrase.length / 20, 2);
    
    return freqScore + lengthScore;
  }

  /**
   * Select final keywords from all candidates
   */
  private selectKeywords(candidates: Array<{ word: string; score: number }>): string[] {
    // Remove duplicates and sort by score
    const uniqueCandidates = new Map<string, number>();
    
    for (const candidate of candidates) {
      const normalized = candidate.word.toLowerCase();
      const existingScore = uniqueCandidates.get(normalized) || 0;
      uniqueCandidates.set(normalized, Math.max(existingScore, candidate.score));
    }
    
    // Convert back to array and sort
    const sorted = Array.from(uniqueCandidates.entries())
      .map(([word, score]) => ({ word, score }))
      .sort((a, b) => b.score - a.score);
    
    // Filter by minimum score and length
    const filtered = sorted.filter(item => 
      item.score > 0.1 && 
      item.word.length > 2 && 
      item.word.length < 50 &&
      !this.isUnwantedKeyword(item.word)
    );
    
    // Return top keywords
    const maxKeywords = this.config.maxKeywords || 35;
    return filtered.slice(0, maxKeywords).map(item => item.word);
  }

  /**
   * Check if keyword should be filtered out
   */
  private isUnwantedKeyword(word: string): boolean {
    const unwantedPatterns = [
      /^\d+$/, // Pure numbers
      /^[^\w]*$/, // Only punctuation
      /^(the|and|or|but|in|on|at|to|for|of|with|by)$/i, // Common stopwords
      /^(this|that|these|those|here|there|when|where|what|who|how|why)$/i,
      /^(said|says|according|reported|announced|stated|mentioned)$/i, // News-specific
      /^(click|read|more|view|see|watch|follow|share|like|comment)$/i, // Web-specific
      /^(nbsp|amp|quot|copy|trade|reg|hellip)$/i, // HTML entities
      /^[a-z]$/i, // Single letters
      /(.)\1{2,}/, // Repeated characters (aaa, bbb, etc.)
    ];
    
    for (const pattern of unwantedPatterns) {
      if (pattern.test(word)) {
        return true;
      }
    }
    
    return false;
  }
}