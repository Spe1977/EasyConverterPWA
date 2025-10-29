import { Injectable, inject } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';

/**
 * Tipo di errore per categorizzare gli errori
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Opzioni per la gestione degli errori
 */
export interface ErrorHandlingOptions {
  severity?: ErrorSeverity;
  duration?: number; // Durata del toast in ms (default: 3000)
  showAsAlert?: boolean; // Mostra come alert invece di toast
  header?: string; // Header per alert
  context?: string; // Contesto dell'errore per logging
}

/**
 * Error Service
 * Servizio centralizzato per la gestione uniforme degli errori nell'applicazione.
 * Gestisce toast, alert e logging in modo consistente.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorService {
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);

  /**
   * Mostra un messaggio di errore
   */
  async showError(message: string, options: ErrorHandlingOptions = {}): Promise<void> {
    const { duration = 3000, showAsAlert = false, header = 'Errore', context } = options;

    // Log error to console in development
    if (context) {
      console.error(`[${context}] ${message}`);
    } else {
      console.error(message);
    }

    if (showAsAlert) {
      await this.showAlert(header, message, 'danger');
    } else {
      await this.showToast(message, 'danger', duration);
    }
  }

  /**
   * Mostra un messaggio di successo
   */
  async showSuccess(message: string, duration: number = 3000): Promise<void> {
    await this.showToast(message, 'success', duration);
  }

  /**
   * Mostra un messaggio di warning
   */
  async showWarning(message: string, duration: number = 3000): Promise<void> {
    await this.showToast(message, 'warning', duration);
  }

  /**
   * Mostra un messaggio informativo
   */
  async showInfo(message: string, duration: number = 3000): Promise<void> {
    await this.showToast(message, 'primary', duration);
  }

  /**
   * Gestisce un errore in modo intelligente
   * Estrae il messaggio dall'errore e lo mostra all'utente
   */
  async handleError(
    error: unknown,
    context: string,
    fallbackMessage: string = 'Si è verificato un errore',
    options: ErrorHandlingOptions = {}
  ): Promise<void> {
    let errorMessage = fallbackMessage;

    // Estrai il messaggio dall'errore
    if (error instanceof Error) {
      errorMessage = `${fallbackMessage}: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = `${fallbackMessage}: ${error}`;
    }

    await this.showError(errorMessage, { ...options, context });
  }

  /**
   * Mostra un alert
   */
  private async showAlert(
    header: string,
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary' = 'primary'
  ): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
      cssClass: `alert-${color}`,
    });
    await alert.present();
  }

  /**
   * Mostra un toast
   */
  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'primary',
    duration: number
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  /**
   * Mostra un alert di conferma
   * @returns true se l'utente conferma, false altrimenti
   */
  async showConfirmation(
    header: string,
    message: string,
    confirmText: string = 'Conferma',
    cancelText: string = 'Annulla'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: confirmText,
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }
}
