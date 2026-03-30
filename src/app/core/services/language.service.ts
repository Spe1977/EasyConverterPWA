import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service for managing application language
 * Handles language switching and persistence in localStorage
 */
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translate = inject(TranslateService);
  private readonly STORAGE_KEY = 'easyconverter_language';
  private readonly AVAILABLE_LANGUAGES = ['en', 'it'];
  private readonly DEFAULT_LANGUAGE = 'en';

  constructor() {
    this.initializeLanguage();
  }

  /**
   * Initialize language on app startup
   * Priority: localStorage > browser language > default
   */
  private initializeLanguage(): void {
    // Check if language is stored in localStorage
    const storedLang = this.getStoredLanguage();

    if (storedLang && this.isLanguageAvailable(storedLang)) {
      this.setLanguage(storedLang);
      return;
    }

    // Try to use browser language
    const browserLang = this.translate.getBrowserLang();
    if (browserLang && this.isLanguageAvailable(browserLang)) {
      this.setLanguage(browserLang);
      return;
    }

    // Fallback to default language
    this.setLanguage(this.DEFAULT_LANGUAGE);
  }

  /**
   * Set the current language
   * @param lang Language code (e.g., 'en', 'it')
   */
  setLanguage(lang: string): void {
    if (!this.isLanguageAvailable(lang)) {
      console.warn(`Language '${lang}' not available, using default`);
      lang = this.DEFAULT_LANGUAGE;
    }

    this.translate.use(lang);
    this.saveLanguage(lang);
  }

  /**
   * Get the current language code
   */
  getCurrentLanguage(): string {
    return this.translate.currentLang || this.DEFAULT_LANGUAGE;
  }

  /**
   * Get all available language codes
   */
  getAvailableLanguages(): string[] {
    return [...this.AVAILABLE_LANGUAGES];
  }

  /**
   * Toggle between available languages
   * Useful for a simple language switcher button
   */
  toggleLanguage(): void {
    const currentLang = this.getCurrentLanguage();
    const currentIndex = this.AVAILABLE_LANGUAGES.indexOf(currentLang);
    const nextIndex = (currentIndex + 1) % this.AVAILABLE_LANGUAGES.length;
    const nextLang = this.AVAILABLE_LANGUAGES[nextIndex];

    this.setLanguage(nextLang);
  }

  /**
   * Check if a language is available
   */
  private isLanguageAvailable(lang: string): boolean {
    return this.AVAILABLE_LANGUAGES.includes(lang);
  }

  /**
   * Get stored language from localStorage
   */
  private getStoredLanguage(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error reading language from localStorage:', error);
      return null;
    }
  }

  /**
   * Save language to localStorage
   */
  private saveLanguage(lang: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language to localStorage:', error);
    }
  }
}
