import { Component, OnInit, inject } from '@angular/core';
import { PwaUpdateService } from '@core/services/pwa-update.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly pwaUpdateService = inject(PwaUpdateService);

  ngOnInit(): void {
    // Initialize PWA update checking
    this.pwaUpdateService.initializeUpdateChecking();
  }
}
