import { Component, inject } from '@angular/core';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private languageService = inject(LanguageService);

  // PWA update checking is now initialized via APP_INITIALIZER in app.module.ts
  // This prevents memory leaks from component lifecycle subscriptions
  // Language service is initialized on app startup to set up i18n
}
