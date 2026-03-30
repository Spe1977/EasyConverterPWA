import { Component, inject, signal } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { LanguageService } from '@core/services/language.service';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Language switcher component
 * Displays a button to toggle between IT and EN languages
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [IonicModule, TranslateModule],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent {
  private languageService = inject(LanguageService);
  currentLanguage = signal<string>('en');

  constructor() {
    this.currentLanguage.set(this.languageService.getCurrentLanguage());
  }

  /**
   * Toggle between languages
   */
  toggleLanguage(): void {
    this.languageService.toggleLanguage();
    this.currentLanguage.set(this.languageService.getCurrentLanguage());
  }

  /**
   * Get the flag emoji for the current language
   */
  getLanguageFlag(): string {
    const flags: { [key: string]: string } = {
      en: '🇬🇧',
      it: '🇮🇹',
    };
    return flags[this.currentLanguage()] || '🌐';
  }

  /**
   * Get the language label (IT/EN)
   */
  getLanguageLabel(): string {
    return this.currentLanguage().toUpperCase();
  }
}
