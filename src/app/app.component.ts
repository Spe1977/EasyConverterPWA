import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  // PWA update checking is now initialized via APP_INITIALIZER in app.module.ts
  // This prevents memory leaks from component lifecycle subscriptions
}
