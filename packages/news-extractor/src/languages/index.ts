/**
 * Language Detection and Processing
 * Ported from Python newspaper4k languages/__init__.py
 */

export * from './language-detector.js'
export * from './language-config.js'
export * from './tokenizers/index.js'
export * from './unicode-ranges.js'

// Language constants ported from Python
export const LANGUAGES: Array<[string, string]> = [
  ["af", "Afrikaans"],
  ["ar", "Arabic"],
  ["be", "Belarusian"],
  ["bg", "Bulgarian"],
  ["bn", "Bengali"],
  ["ca", "Catalan"],
  ["cs", "Czech"],
  ["cy", "Welsh"],
  ["da", "Danish"],
  ["de", "German"],
  ["el", "Greek"],
  ["en", "English"],
  ["es", "Spanish"],
  ["et", "Estonian"],
  ["eu", "Basque"],
  ["fa", "Persian"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["ga", "Irish"],
  ["gl", "Galician"],
  ["he", "Hebrew"],
  ["hi", "Hindi"],
  ["hr", "Croatian"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["is", "Icelandic"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ka", "Georgian"],
  ["kk", "Kazakh"],
  ["ko", "Korean"],
  ["lt", "Lithuanian"],
  ["lv", "Latvian"],
  ["mk", "Macedonian"],
  ["ms", "Malay"],
  ["mt", "Maltese"],
  ["nb", "Norwegian Bokmål"],
  ["ne", "Nepali"],
  ["nl", "Dutch"],
  ["nn", "Norwegian Nynorsk"],
  ["no", "Norwegian"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["sq", "Albanian"],
  ["sr", "Serbian"],
  ["sv", "Swedish"],
  ["sw", "Swahili"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["ur", "Urdu"],
  ["vi", "Vietnamese"],
  ["zh", "Chinese"]
]

export const LANGUAGES_DICT = new Map(LANGUAGES)

/**
 * Get language name from ISO 639-1 code
 */
export function getLanguageFromIso6391(code: string): string | undefined {
  return LANGUAGES_DICT.get(code.toLowerCase())
}

/**
 * Get available languages (currently all defined languages)
 */
export function getAvailableLanguages(): string[] {
  return LANGUAGES.map(([code]) => code)
}

/**
 * Check if language code is valid
 */
export function isValidLanguage(code: string): boolean {
  return LANGUAGES_DICT.has(code.toLowerCase())
}

/**
 * Normalize language code (convert to lowercase, extract first 2 chars)
 */
export function normalizeLanguageCode(code: string): string {
  return code.toLowerCase().substring(0, 2)
}