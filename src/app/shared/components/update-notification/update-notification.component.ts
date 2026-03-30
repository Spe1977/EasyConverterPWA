import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';

import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { PwaUpdateService } from '@core/services/pwa-update.service';
import { Subscription } from 'rxjs';

/**
 * Component that displays update notifications for the PWA
 * Shows a banner when a new version is available with action to update
 */
@Component({
  selector: 'app-update-notification',
  standalone: true,
  imports: [IonicModule, TranslateModule],
  template: `
    @if (updateAvailable()) {
      <ion-card class="update-card">
        <ion-card-content>
          <div class="update-content">
            <div class="update-icon">
              <ion-icon name="cloud-download-outline" color="primary"></ion-icon>
            </div>
            <div class="update-text">
              <h3>{{ 'PWA_UPDATE.NEW_VERSION' | translate }}</h3>
              <p>{{ 'PWA_UPDATE.NEW_VERSION_DETAIL' | translate }}</p>
            </div>
            <div class="update-actions">
              <ion-button size="small" (click)="activateUpdate()">
                <ion-icon slot="start" name="refresh-outline"></ion-icon>
                {{ 'PWA_UPDATE.UPDATE_NOW' | translate }}
              </ion-button>
              <ion-button size="small" fill="clear" (click)="dismissUpdate()">
                <ion-icon slot="icon-only" name="close-outline"></ion-icon>
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
    }

    @if (showErrorToast()) {
      <ion-toast
        [isOpen]="showErrorToast()"
        [message]="'PWA_UPDATE.UPDATE_ERROR' | translate"
        [duration]="3000"
        color="danger"
        (didDismiss)="showErrorToast.set(false)"
      ></ion-toast>
    }
  `,
  styles: [
    `
      .update-card {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 32px);
        max-width: 500px;
        margin: 0;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          transform: translateX(-50%) translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }

      .update-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .update-icon ion-icon {
        font-size: 32px;
      }

      .update-text {
        flex: 1;
      }

      .update-text h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .update-text p {
        margin: 0;
        font-size: 14px;
        color: var(--ion-color-medium);
      }

      .update-actions {
        display: flex;
        gap: 4px;
      }

      @media (max-width: 576px) {
        .update-card {
          bottom: 8px;
          width: calc(100% - 16px);
        }

        .update-content {
          flex-wrap: wrap;
        }

        .update-actions {
          width: 100%;
          justify-content: flex-end;
          margin-top: 8px;
        }
      }
    `,
  ],
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  private readonly pwaUpdateService = inject(PwaUpdateService);

  updateAvailable = signal(false);
  showErrorToast = signal(false);
  private subscriptions = new Subscription();

  ngOnInit(): void {
    // Listen for updates
    const updateSub = this.pwaUpdateService.listenForUpdates().subscribe((event) => {
      console.log('New version available:', event.latestVersion);
      this.updateAvailable.set(true);
    });
    this.subscriptions.add(updateSub);

    // Handle unrecoverable state
    const unrecoverableSub = this.pwaUpdateService.getUnrecoverableState().subscribe((event) => {
      console.error('App is in unrecoverable state:', event.reason);
      this.showErrorToast.set(true);
    });
    this.subscriptions.add(unrecoverableSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Activate the update and reload the page
   */
  async activateUpdate(): Promise<void> {
    try {
      await this.pwaUpdateService.activateUpdate();
      // Page will reload automatically
    } catch (err) {
      console.error('Failed to activate update:', err);
      this.showErrorToast.set(true);
    }
  }

  /**
   * Dismiss the update notification
   * User can continue using the current version
   */
  dismissUpdate(): void {
    this.updateAvailable.set(false);
  }
}
