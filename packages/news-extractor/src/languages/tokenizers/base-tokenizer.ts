/**
 * Base Tokenizer Interface
 * Defines contract for language-specific tokenizers
 */

export interface BaseTokenizer {
  /**
   * Tokenize text into individual words/tokens
   */
  tokenize(text: string): string[]

  /**
   * Get language code this tokenizer handles
   */
  getLanguage(): string

  /**
   * Optional: Custom stopword detection for this language
   * Some languages need special handling for stopword matching
   */
  findStopwords?(tokens: string[], stopwords: Set<string>): string[]
}

/**
 * Abstract base class for tokenizers
 */
export abstract class AbstractTokenizer implements BaseTokenizer {
  protected language: string

  constructor(language: string) {
    this.language = language
  }

  abstract tokenize(text: string): string[]

  getLanguage(): string {
    return this.language
  }

  /**
   * Default stopword detection - exact matching
   */
  findStopwords(tokens: string[], stopwords: Set<string>): string[] {
    return tokens.filter(token => stopwords.has(token.toLowerCase()))
  }

  /**
   * Clean and normalize text before tokenization
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim()
  }

  /**
   * Filter tokens by length and content
   */
  protected filterTokens(tokens: string[], minLength = 1): string[] {
    return tokens
      .filter(token => token.length >= minLength)
      .filter(token => token.trim().length > 0)
  }
}