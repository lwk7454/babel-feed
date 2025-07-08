/**
 * Language Configuration Management
 * Integration point for language settings with Configuration class
 */

import { getAvailableLanguages, isValidLanguage } from './index.js'
import { LanguageDetector } from './language-detector.js'
import type { CheerioAPI } from 'cheerio'

export interface LanguageSettings {
  language: string
  useMetaLanguage: boolean
  availableLanguages: string[]
}

export class LanguageManager {
  private settings: LanguageSettings

  constructor(language = 'en', useMetaLanguage = true) {
    this.settings = {
      language: this.validateLanguage(language),
      useMetaLanguage,
      availableLanguages: getAvailableLanguages()
    }
  }

  /**
   * Detect article language from HTML with configuration fallback
   */
  detectLanguage($: CheerioAPI): string {
    return LanguageDetector.detectWithFallback(
      $, 
      this.settings.language, 
      this.settings.useMetaLanguage
    )
  }

  /**
   * Set language with validation
   */
  setLanguage(language: string | null): void {
    if (language === null) {
      // Enable auto-detection
      this.settings.useMetaLanguage = true
      this.settings.language = 'en'
      return
    }

    this.settings.language = this.validateLanguage(language)
    // Disable auto-detection when explicitly set
    this.settings.useMetaLanguage = false
  }

  /**
   * Enable or disable meta language detection
   */
  setUseMetaLanguage(useMetaLanguage: boolean): void {
    this.settings.useMetaLanguage = useMetaLanguage
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.settings.language
  }

  /**
   * Check if meta language detection is enabled
   */
  getUseMetaLanguage(): boolean {
    return this.settings.useMetaLanguage
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return [...this.settings.availableLanguages]
  }

  /**
   * Validate language code
   */
  private validateLanguage(language: string): string {
    if (!language || language.length !== 2) {
      throw new Error(
        'Language must be a 2-character language code (e.g., "en" for English, "de" for German)'
      )
    }

    const normalizedLang = language.toLowerCase()
    if (!isValidLanguage(normalizedLang)) {
      const available = this.settings.availableLanguages.join(', ')
      throw new Error(
        `Language '${language}' is not supported. Supported languages: ${available}`
      )
    }

    return normalizedLang
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.settings.availableLanguages.includes(language.toLowerCase())
  }

  /**
   * Get language configuration as plain object
   */
  toJSON(): LanguageSettings {
    return { ...this.settings }
  }

  /**
   * Create LanguageManager from configuration object
   */
  static fromJSON(config: Partial<LanguageSettings>): LanguageManager {
    const manager = new LanguageManager(
      config.language || 'en',
      config.useMetaLanguage ?? true
    )
    return manager
  }
}