import { Injectable, ApplicationRef, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first, interval, Subscription } from 'rxjs';

/**
 * Service to manage PWA updates and notify users
 * Handles Service Worker update detection and activation
 */
@Injectable({
  providedIn: 'root',
})
export class PwaUpdateService implements OnDestroy {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);
  private updateCheckSubscription?: Subscription;

  /**
   * Initialize update checking
   * Checks for updates every 6 hours when the app is stable
   */
  public initializeUpdateChecking(): void {
    if (!this.swUpdate.isEnabled) {
      console.log('Service Worker is not enabled');
      return;
    }

    // Check for updates when app becomes stable
    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));

    // Check for updates every 6 hours
    const everyHours$ = interval(6 * 60 * 60 * 1000);

    // Initialize subscription container first
    this.updateCheckSubscription = new Subscription();

    // Store subscription for cleanup
    const stableSub = appIsStable$.subscribe(() => {
      const intervalSub = everyHours$.subscribe(async () => {
        try {
          const updateFound = await this.swUpdate.checkForUpdate();
          console.log(
            updateFound ? 'A new version is available.' : 'Already on the latest version.'
          );
        } catch (err) {
          console.error('Failed to check for updates:', err);
        }
      });

      // Add nested subscription to parent for proper cleanup
      // Safe because updateCheckSubscription is initialized before subscribe
      this.updateCheckSubscription!.add(intervalSub);
    });

    // Add the stable subscription to parent
    this.updateCheckSubscription.add(stableSub);
  }

  /**
   * Listen for available updates
   * Returns observable that emits when a new version is ready
   */
  public listenForUpdates() {
    return this.swUpdate.versionUpdates.pipe(
      filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
    );
  }

  /**
   * Activate the latest version
   * Reloads the page to activate the new service worker
   */
  public async activateUpdate(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
      document.location.reload();
    } catch (err) {
      console.error('Failed to activate update:', err);
      throw err;
    }
  }

  /**
   * Get unrecoverable state observable
   * Emits when the app is in an unrecoverable state
   */
  public getUnrecoverableState() {
    return this.swUpdate.unrecoverable;
  }

  /**
   * Check if Service Worker is enabled
   */
  public isEnabled(): boolean {
    return this.swUpdate.isEnabled;
  }

  /**
   * Manually check for updates
   */
  public async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      return false;
    }

    try {
      return await this.swUpdate.checkForUpdate();
    } catch (err) {
      console.error('Failed to check for updates:', err);
      return false;
    }
  }

  /**
   * Cleanup subscriptions when service is destroyed
   */
  ngOnDestroy(): void {
    this.updateCheckSubscription?.unsubscribe();
  }
}
