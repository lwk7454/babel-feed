/**
 * ISO 639-1 language codes and related data
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  unicodeRanges?: string[];
}

export const LANGUAGE_CODES: Record<string, LanguageInfo> = {
  'en': {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr'
  },
  'zh': {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    unicodeRanges: ['CJK Unified Ideographs', 'CJK Compatibility']
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    unicodeRanges: ['Hiragana', 'Katakana', 'CJK Unified Ideographs']
  },
  'ko': {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    unicodeRanges: ['Hangul Syllables', 'Hangul Jamo']
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    unicodeRanges: ['Arabic']
  },
  'ru': {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    unicodeRanges: ['Cyrillic']
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr'
  },
  'fr': {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr'
  },
  'de': {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr'
  },
  'it': {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr'
  },
  'pt': {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr'
  },
  'nl': {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    direction: 'ltr'
  },
  'sv': {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    direction: 'ltr'
  },
  'no': {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    direction: 'ltr'
  },
  'da': {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    direction: 'ltr'
  },
  'fi': {
    code: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    direction: 'ltr'
  }
}

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CODES)

export function getLanguageInfo(code: string): LanguageInfo | null {
  return LANGUAGE_CODES[code] || null
}

export function isRTL(languageCode: string): boolean {
  const info = getLanguageInfo(languageCode)
  return info?.direction === 'rtl'
}

export function getLanguageName(code: string, useNative = false): string {
  const info = getLanguageInfo(code)
  if (!info) return code
  
  return useNative ? info.nativeName : info.name
}