import { ArticleConfig } from '../types';
import { LANGUAGE_CONFIGS } from '../config';
import { TextUtils } from '../utils/text-utils';

/**
 * Generates article summaries using extractive summarization
 */
export class Summarizer {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Summarize text content
   */
  async summarize(text: string, language: string = 'en'): Promise<string> {
    if (!text || text.length < 100) {
      return '';
    }

    // Split into sentences
    const sentences = this.splitSentences(text, language);
    
    if (sentences.length <= 3) {
      // If only a few sentences, return them all
      return sentences.join(' ').trim();
    }

    // Score sentences
    const scoredSentences = this.scoreSentences(sentences, text, language);
    
    // Select best sentences
    const selectedSentences = this.selectSentences(scoredSentences);
    
    // Order sentences by original position
    const orderedSentences = this.orderSentences(selectedSentences, sentences);
    
    return orderedSentences.join(' ').trim();
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string, language: string): string[] {
    const langConfig = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    const sentenceEnders = langConfig?.sentenceEnders || ['.', '!', '?', '\n\n'];
    
    // Create regex pattern for sentence endings
    const enderPattern = sentenceEnders.map(ender => 
      ender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    const regex = new RegExp(`(${enderPattern})`, 'g');
    
    // Split and clean sentences
    const rawSentences = text.split(regex);
    const sentences: string[] = [];
    
    for (let i = 0; i < rawSentences.length; i += 2) {
      const sentence = rawSentences[i];
      const ender = rawSentences[i + 1] || '';
      
      if (sentence && sentence.trim()) {
        const fullSentence = (sentence + ender).trim();
        if (this.isValidSentence(fullSentence, language)) {
          sentences.push(fullSentence);
        }
      }
    }
    
    return sentences;
  }

  /**
   * Check if sentence is valid for summarization
   */
  private isValidSentence(sentence: string, language: string): boolean {
    // Minimum length
    if (sentence.length < 20) return false;
    
    // Maximum length
    if (sentence.length > 500) return false;
    
    // Must contain letters
    if (!/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff]/.test(sentence)) {
      return false;
    }
    
    // Word count check for non-CJK languages
    if (!['zh', 'ja', 'ko'].includes(language)) {
      const wordCount = TextUtils.countWords(sentence);
      if (wordCount < 5 || wordCount > 50) return false;
    }
    
    // Filter out common non-content sentences
    const unwantedPatterns = [
      /^(read more|click here|view gallery|watch video|follow us|subscribe)/i,
      /^(copyright|all rights reserved|terms of service|privacy policy)/i,
      /^(advertisement|sponsored content|paid promotion)/i,
      /^(share|like|comment|tweet|pin)/i,
      /^\d+[\s\-\.]/, // Lists starting with numbers
      /^[A-Z\s]+$/, // All caps (likely headlines/titles)
      /\b(lorem ipsum|placeholder|example|test)\b/i
    ];
    
    for (const pattern of unwantedPatterns) {
      if (pattern.test(sentence)) return false;
    }
    
    return true;
  }

  /**
   * Score sentences for importance
   */
  private scoreSentences(
    sentences: string[], 
    fullText: string, 
    language: string
  ): Array<{ sentence: string; score: number; position: number }> {
    const wordFreqs = this.calculateWordFrequencies(fullText, language);
    const totalWords = Array.from(wordFreqs.values()).reduce((sum, count) => sum + count, 0);
    
    return sentences.map((sentence, index) => ({
      sentence,
      score: this.scoreSentence(sentence, index, sentences.length, wordFreqs, totalWords, language),
      position: index
    }));
  }

  /**
   * Score individual sentence
   */
  private scoreSentence(
    sentence: string,
    position: number,
    totalSentences: number,
    wordFreqs: Map<string, number>,
    totalWords: number,
    language: string
  ): number {
    let score = 0;
    
    // 1. Position score (earlier sentences are more important)
    const positionScore = this.calculatePositionScore(position, totalSentences);
    score += positionScore * 2;
    
    // 2. Word frequency score
    const freqScore = this.calculateFrequencyScore(sentence, wordFreqs, totalWords, language);
    score += freqScore * 3;
    
    // 3. Length score (prefer moderate length)
    const lengthScore = this.calculateLengthScore(sentence, language);
    score += lengthScore * 1;
    
    // 4. Numerical data score
    const numericalScore = this.calculateNumericalScore(sentence);
    score += numericalScore * 1.5;
    
    // 5. Title similarity score
    const titleScore = this.calculateTitleSimilarity(sentence, language);
    score += titleScore * 1.5;
    
    // 6. Proper noun score
    const properNounScore = this.calculateProperNounScore(sentence, language);
    score += properNounScore * 1;
    
    return score;
  }

  /**
   * Calculate position-based score
   */
  private calculatePositionScore(position: number, totalSentences: number): number {
    // First and last sentences are more important
    if (position === 0) return 3;
    if (position === totalSentences - 1) return 2;
    if (position < 3) return 2;
    if (position < totalSentences * 0.3) return 1.5;
    if (position > totalSentences * 0.7) return 1.2;
    return 1;
  }

  /**
   * Calculate word frequency score
   */
  private calculateFrequencyScore(
    sentence: string,
    wordFreqs: Map<string, number>,
    totalWords: number,
    language: string
  ): number {
    const words = this.extractWords(sentence, language);
    let totalScore = 0;
    let validWords = 0;
    
    for (const word of words) {
      const freq = wordFreqs.get(word.toLowerCase()) || 0;
      if (freq > 1) { // Only consider words that appear multiple times
        totalScore += freq / totalWords;
        validWords++;
      }
    }
    
    return validWords > 0 ? totalScore / validWords : 0;
  }

  /**
   * Calculate length-based score
   */
  private calculateLengthScore(sentence: string, language: string): number {
    if (['zh', 'ja', 'ko'].includes(language)) {
      // For CJK languages, use character count
      const charCount = sentence.length;
      if (charCount >= 30 && charCount <= 150) return 2;
      if (charCount >= 20 && charCount <= 200) return 1;
      return 0.5;
    } else {
      // For other languages, use word count
      const wordCount = TextUtils.countWords(sentence);
      if (wordCount >= 15 && wordCount <= 30) return 2;
      if (wordCount >= 10 && wordCount <= 40) return 1;
      return 0.5;
    }
  }

  /**
   * Calculate numerical data score
   */
  private calculateNumericalScore(sentence: string): number {
    // Sentences with numbers, dates, percentages are often important
    const numericalPatterns = [
      /\d+%/, // Percentages
      /\$\d+/, // Money
      /\d{4}/, // Years
      /\d+\s*(million|billion|thousand|percent)/i,
      /\b\d+\.\d+\b/, // Decimals
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+/i
    ];
    
    let score = 0;
    for (const pattern of numericalPatterns) {
      if (pattern.test(sentence)) {
        score += 0.5;
      }
    }
    
    return Math.min(score, 2); // Cap at 2
  }

  /**
   * Calculate title similarity score
   */
  private calculateTitleSimilarity(sentence: string, language: string): number {
    // This is a simplified implementation
    // In practice, you'd want to compare with the actual article title
    
    // Look for common title-like patterns
    const titlePatterns = [
      /^[A-Z].*[.!?]$/, // Starts with capital, ends with punctuation
      /\b(announces|reveals|reports|confirms|says|states)\b/i,
      /\b(new|latest|breaking|major|significant)\b/i
    ];
    
    let score = 0;
    for (const pattern of titlePatterns) {
      if (pattern.test(sentence)) {
        score += 0.3;
      }
    }
    
    return Math.min(score, 1);
  }

  /**
   * Calculate proper noun score
   */
  private calculateProperNounScore(sentence: string, language: string): number {
    if (['zh', 'ja', 'ko'].includes(language)) {
      // For CJK languages, this is more complex
      return 0;
    }
    
    // Count capitalized words (likely proper nouns)
    const words = sentence.split(/\s+/);
    const capitalizedWords = words.filter(word => 
      /^[A-Z][a-z]/.test(word) && 
      word.length > 2 &&
      !this.isCommonWord(word.toLowerCase())
    );
    
    const ratio = capitalizedWords.length / words.length;
    return Math.min(ratio * 2, 1);
  }

  /**
   * Extract words from sentence
   */
  private extractWords(sentence: string, language: string): string[] {
    if (['zh', 'ja', 'ko'].includes(language)) {
      // For CJK languages, basic character-based extraction
      return Array.from(sentence).filter(char => 
        /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)
      );
    }
    
    // For other languages
    return sentence
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Calculate word frequencies from full text
   */
  private calculateWordFrequencies(text: string, language: string): Map<string, number> {
    const words = this.extractWords(text, language);
    const freqs = new Map<string, number>();
    
    for (const word of words) {
      if (!this.isStopword(word, language)) {
        freqs.set(word, (freqs.get(word) || 0) + 1);
      }
    }
    
    return freqs;
  }

  /**
   * Check if word is a stopword
   */
  private isStopword(word: string, language: string): boolean {
    const langConfig = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    if (langConfig) {
      return langConfig.stopwords.includes(word.toLowerCase());
    }
    
    // Basic English stopwords as fallback
    const basicStopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return basicStopwords.includes(word.toLowerCase());
  }

  /**
   * Check if word is common (not a proper noun)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    ];
    return commonWords.includes(word);
  }

  /**
   * Select best sentences for summary
   */
  private selectSentences(
    scoredSentences: Array<{ sentence: string; score: number; position: number }>
  ): Array<{ sentence: string; position: number }> {
    // Sort by score descending
    const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
    
    // Select top sentences
    const maxSentences = Math.min(
      this.config.maxSummarySent || 5,
      Math.max(2, Math.floor(scoredSentences.length * 0.3))
    );
    
    const selected = sorted.slice(0, maxSentences);
    
    // Remove very similar sentences (basic deduplication)
    const deduplicated = this.deduplicateSentences(selected);
    
    return deduplicated;
  }

  /**
   * Remove very similar sentences
   */
  private deduplicateSentences(
    sentences: Array<{ sentence: string; position: number }>
  ): Array<{ sentence: string; position: number }> {
    const result: Array<{ sentence: string; position: number }> = [];
    
    for (const sentence of sentences) {
      let isSimilar = false;
      
      for (const existing of result) {
        if (this.areSentencesSimilar(sentence.sentence, existing.sentence)) {
          isSimilar = true;
          break;
        }
      }
      
      if (!isSimilar) {
        result.push(sentence);
      }
    }
    
    return result;
  }

  /**
   * Check if two sentences are very similar
   */
  private areSentencesSimilar(sentence1: string, sentence2: string): boolean {
    // Simple similarity check based on common words
    const words1 = new Set(sentence1.toLowerCase().split(/\s+/));
    const words2 = new Set(sentence2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.6; // 60% similarity threshold
  }

  /**
   * Order sentences by their original position
   */
  private orderSentences(
    selectedSentences: Array<{ sentence: string; position: number }>,
    originalSentences: string[]
  ): string[] {
    // Sort by original position
    const ordered = [...selectedSentences].sort((a, b) => a.position - b.position);
    
    return ordered.map(item => item.sentence);
  }
}