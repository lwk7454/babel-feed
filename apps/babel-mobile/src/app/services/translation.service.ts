import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface TranslationData {
  [key: string]: string | TranslationData;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Available languages
  private readonly availableLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  ];

  private currentLanguageSubject = new BehaviorSubject<string>('en');
  private translationsSubject = new BehaviorSubject<TranslationData>({});

  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  public translations$ = this.translationsSubject.asObservable();

  private translations: { [lang: string]: TranslationData } = {};

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize the translation service
   */
  private async initializeService(): Promise<void> {
    // Load saved language from localStorage or default to English
    const savedLanguage = localStorage.getItem('babel-feed-language') || 'en';
    await this.setLanguage(savedLanguage);
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Language[] {
    return this.availableLanguages;
  }

  /**
   * Get current language code
   */
  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  /**
   * Get current language object
   */
  getCurrentLanguageInfo(): Language | undefined {
    const currentCode = this.getCurrentLanguage();
    return this.availableLanguages.find(lang => lang.code === currentCode);
  }

  /**
   * Set the current language and load translations
   */
  async setLanguage(languageCode: string): Promise<void> {
    if (!this.availableLanguages.find(lang => lang.code === languageCode)) {
      console.warn(`Language ${languageCode} not supported, falling back to English`);
      languageCode = 'en';
    }

    try {
      // Load translations for the selected language
      await this.loadTranslations(languageCode);
      
      // Update current language
      this.currentLanguageSubject.next(languageCode);
      
      // Save to localStorage
      localStorage.setItem('babel-feed-language', languageCode);
      
      // Update translations subject
      this.translationsSubject.next(this.translations[languageCode] || {});
      
    } catch (error) {
      console.error(`Failed to load translations for ${languageCode}:`, error);
      // Fallback to English if loading fails
      if (languageCode !== 'en') {
        await this.setLanguage('en');
      }
    }
  }

  /**
   * Load translations for a specific language
   */
  private async loadTranslations(languageCode: string): Promise<void> {
    if (this.translations[languageCode]) {
      return; // Already loaded
    }

    try {
      // Import translation file dynamically
      const translationModule = await import(`../translations/${languageCode}.json`);
      this.translations[languageCode] = translationModule.default || translationModule;
    } catch (error) {
      console.warn(`Translation file for ${languageCode} not found, using fallback`);
      // Use English as fallback
      if (languageCode !== 'en') {
        try {
          const fallbackModule = await import(`../translations/en.json`);
          this.translations[languageCode] = fallbackModule.default || fallbackModule;
        } catch (fallbackError) {
          console.error('Failed to load fallback translations:', fallbackError);
          this.translations[languageCode] = {};
        }
      } else {
        this.translations[languageCode] = {};
      }
    }
  }

  /**
   * Get translation for a key
   */
  translate(key: string, params?: { [key: string]: string | number }): string {
    const currentLang = this.getCurrentLanguage();
    const translations = this.translations[currentLang] || {};
    
    let translation = this.getNestedTranslation(translations, key);
    
    // Fallback to English if translation not found
    if (!translation && currentLang !== 'en') {
      const englishTranslations = this.translations['en'] || {};
      translation = this.getNestedTranslation(englishTranslations, key);
    }
    
    // Fallback to the key itself if no translation found
    if (!translation) {
      translation = key;
    }

    // Replace parameters if provided
    if (params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), String(params[param]));
      });
    }

    return translation;
  }

  /**
   * Get nested translation using dot notation
   */
  private getNestedTranslation(translations: TranslationData, key: string): string {
    const keys = key.split('.');
    let current: any = translations;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return '';
      }
    }
    
    return typeof current === 'string' ? current : '';
  }

  /**
   * Get translation as observable
   */
  translate$(key: string, params?: { [key: string]: string | number }): Observable<string> {
    return new Observable(observer => {
      const updateTranslation = () => {
        observer.next(this.translate(key, params));
      };

      // Initial value
      updateTranslation();

      // Subscribe to language changes
      const subscription = this.currentLanguage$.subscribe(() => {
        updateTranslation();
      });

      // Cleanup
      return () => subscription.unsubscribe();
    });
  }
} 