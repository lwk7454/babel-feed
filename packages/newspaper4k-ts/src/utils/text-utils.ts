import { LANGUAGE_CONFIGS } from '../config';

/**
 * Text processing utility functions
 */
export class TextUtils {
  /**
   * Count words in text
   */
  static countWords(text: string): number {
    if (!text) return 0;
    
    // For CJK languages, count characters instead of words
    if (this.isCJKText(text)) {
      return this.countCJKCharacters(text);
    }
    
    // For other languages, split on whitespace
    const words = text.trim().split(/\s+/);
    return words.filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in text
   */
  static countSentences(text: string): number {
    if (!text) return 0;
    
    // Common sentence endings
    const sentenceEndings = /[.!?。！？；]/g;
    const matches = text.match(sentenceEndings);
    return matches ? matches.length : 1;
  }

  /**
   * Count paragraphs in text
   */
  static countParagraphs(text: string): number {
    if (!text) return 0;
    
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return paragraphs.length;
  }

  /**
   * Calculate reading time in minutes
   */
  static calculateReadingTime(text: string): number {
    const wordCount = this.countWords(text);
    
    // Average reading speed: 200-250 words per minute
    // For CJK languages, adjust the rate
    const wordsPerMinute = this.isCJKText(text) ? 300 : 225;
    
    const minutes = wordCount / wordsPerMinute;
    return Math.max(1, Math.round(minutes));
  }

  /**
   * Calculate text complexity score (0-10)
   */
  static calculateComplexity(text: string): number {
    if (!text) return 0;
    
    const wordCount = this.countWords(text);
    const sentenceCount = this.countSentences(text);
    
    if (wordCount === 0 || sentenceCount === 0) return 0;
    
    // Average words per sentence
    const avgWordsPerSentence = wordCount / sentenceCount;
    
    // Average word length
    const avgWordLength = this.calculateAverageWordLength(text);
    
    // Syllable complexity (simplified)
    const syllableComplexity = this.calculateSyllableComplexity(text);
    
    // Combine factors (scale 0-10)
    let complexity = 0;
    
    // Sentence length factor (0-3)
    if (avgWordsPerSentence > 25) complexity += 3;
    else if (avgWordsPerSentence > 20) complexity += 2;
    else if (avgWordsPerSentence > 15) complexity += 1;
    
    // Word length factor (0-3)
    if (avgWordLength > 7) complexity += 3;
    else if (avgWordLength > 6) complexity += 2;
    else if (avgWordLength > 5) complexity += 1;
    
    // Syllable factor (0-2)
    complexity += Math.min(2, syllableComplexity);
    
    // Vocabulary diversity factor (0-2)
    const diversity = this.calculateVocabularyDiversity(text);
    complexity += Math.min(2, diversity * 2);
    
    return Math.min(10, complexity);
  }

  /**
   * Calculate stopword ratio
   */
  static calculateStopwordRatio(text: string, language: string = 'en'): number {
    const words = this.extractWords(text, language);
    if (words.length === 0) return 0;
    
    const langConfig = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    const stopwords = langConfig ? langConfig.stopwords : LANGUAGE_CONFIGS.en.stopwords;
    
    const stopwordSet = new Set(stopwords);
    const stopwordCount = words.filter(word => stopwordSet.has(word.toLowerCase())).length;
    
    return stopwordCount / words.length;
  }

  /**
   * Split text into sentences
   */
  static splitSentences(text: string, language: string = 'en'): string[] {
    const langConfig = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    const sentenceEnders = langConfig?.sentenceEnders || ['.', '!', '?', '\n\n'];
    
    // Create regex pattern for sentence endings
    const enderPattern = sentenceEnders.map(ender => 
      ender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    const sentences = text.split(new RegExp(`(${enderPattern})`))
      .reduce((acc: string[], part, index) => {
        if (index % 2 === 0) {
          // Text part
          if (part.trim()) {
            acc.push(part.trim());
          }
        } else {
          // Punctuation part - add to previous sentence
          if (acc.length > 0) {
            acc[acc.length - 1] += part;
          }
        }
        return acc;
      }, [])
      .filter(sentence => sentence.length > 10);
    
    return sentences;
  }

  /**
   * Extract words from text for given language
   */
  static extractWords(text: string, language: string = 'en'): string[] {
    if (['zh', 'ja', 'ko'].includes(language)) {
      // For CJK languages, extract characters/basic segmentation
      return this.extractCJKWords(text);
    }
    
    // For other languages
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  /**
   * Check if text is primarily CJK (Chinese, Japanese, Korean)
   */
  static isCJKText(text: string): boolean {
    const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g);
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return false;
    
    const cjkRatio = (cjkChars?.length || 0) / totalChars;
    return cjkRatio > 0.3; // More than 30% CJK characters
  }

  /**
   * Count CJK characters (excluding punctuation and whitespace)
   */
  static countCJKCharacters(text: string): number {
    const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g);
    return cjkChars ? cjkChars.length : 0;
  }

  /**
   * Extract words from CJK text
   */
  static extractCJKWords(text: string): string[] {
    // Very basic CJK word extraction
    // In production, use proper segmentation libraries
    const words: string[] = [];
    
    // Extract individual CJK characters
    const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g);
    if (cjkChars) {
      words.push(...cjkChars);
    }
    
    // Extract Latin words
    const latinWords = text.match(/[a-zA-Z]+/g);
    if (latinWords) {
      words.push(...latinWords.filter(word => word.length > 1));
    }
    
    return words;
  }

  /**
   * Calculate average word length
   */
  private static calculateAverageWordLength(text: string): number {
    const words = this.extractWords(text);
    if (words.length === 0) return 0;
    
    const totalLength = words.reduce((sum, word) => sum + word.length, 0);
    return totalLength / words.length;
  }

  /**
   * Calculate syllable complexity (simplified)
   */
  private static calculateSyllableComplexity(text: string): number {
    // Very simplified syllable counting for English
    const words = this.extractWords(text);
    if (words.length === 0) return 0;
    
    let totalSyllables = 0;
    
    for (const word of words) {
      // Simple syllable counting heuristic
      const vowelMatches = word.match(/[aeiouy]+/gi);
      let syllables = vowelMatches ? vowelMatches.length : 1;
      
      // Adjust for silent e
      if (word.endsWith('e')) syllables--;
      if (word.endsWith('le') && word.length > 2) syllables++;
      
      syllables = Math.max(1, syllables);
      totalSyllables += syllables;
    }
    
    const avgSyllablesPerWord = totalSyllables / words.length;
    return Math.min(3, avgSyllablesPerWord - 1); // Normalize to 0-3 range
  }

  /**
   * Calculate vocabulary diversity (unique words / total words)
   */
  private static calculateVocabularyDiversity(text: string): number {
    const words = this.extractWords(text);
    if (words.length === 0) return 0;
    
    const uniqueWords = new Set(words.map(word => word.toLowerCase()));
    return uniqueWords.size / words.length;
  }

  /**
   * Clean and normalize text
   */
  static cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'")
      .trim();
  }

  /**
   * Truncate text to specified length
   */
  static truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength - suffix.length);
    
    // Try to end at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + suffix;
    }
    
    return truncated + suffix;
  }

  /**
   * Extract text between HTML tags
   */
  static extractTextContent(html: string): string {
    // Remove HTML tags
    const withoutTags = html.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    const decoded = withoutTags
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    return this.cleanText(decoded);
  }

  /**
   * Check if text contains meaningful content
   */
  static hasMeaningfulContent(text: string, minLength: number = 50): boolean {
    if (!text || text.length < minLength) return false;
    
    // Check if text has reasonable character distribution
    const letterCount = (text.match(/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
    const letterRatio = letterCount / text.length;
    
    return letterRatio > 0.3; // At least 30% letters
  }
}