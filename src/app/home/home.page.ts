import { Component, signal, inject } from '@angular/core';
import { ConversionFormat } from '@core/models/conversion-format';
import { ConverterService } from '@core/services/converter.service';
import { FileSystemService } from '@core/services/file-system.service';
import { ToastController, AlertController } from '@ionic/angular';
import { environment } from '@env/environment';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  private converterService = inject(ConverterService);
  private fileSystemService = inject(FileSystemService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  selectedFile = signal<File | null>(null);
  sourceFormat = signal<ConversionFormat | null>(null);
  targetFormat = signal<ConversionFormat | null>(null);
  isConverting = signal(false);
  conversionProgress = signal(0);
  availableTargets = signal<ConversionFormat[]>([]);

  // Environment
  maxFileSize = environment.conversion.maxFileSize;

  /**
   * Gestisce la selezione del file
   */
  onFileSelected(file: File): void {
    this.selectedFile.set(file);

    // Rileva automaticamente il formato
    const detectedFormat = this.converterService.detectFormat(file);
    if (detectedFormat) {
      this.sourceFormat.set(detectedFormat);
      this.updateAvailableTargets(detectedFormat);
    } else {
      this.showToast('Could not detect file format', 'warning');
    }

    // Reset target se già selezionato
    this.targetFormat.set(null);
  }

  /**
   * Gestisce errori di file picker
   */
  onFileError(error: string): void {
    this.showToast(error, 'danger');
  }

  /**
   * Gestisce cambio formato sorgente
   */
  onSourceFormatChange(format: ConversionFormat): void {
    this.sourceFormat.set(format);
    this.updateAvailableTargets(format);
    this.targetFormat.set(null); // Reset target
  }

  /**
   * Gestisce cambio formato destinazione
   */
  onTargetFormatChange(format: ConversionFormat): void {
    this.targetFormat.set(format);
  }

  /**
   * Aggiorna i formati di destinazione disponibili
   */
  private updateAvailableTargets(sourceFormat: ConversionFormat): void {
    const targets = this.converterService.getAvailableTargetFormats(sourceFormat);
    this.availableTargets.set(targets);
  }

  /**
   * Verifica se può procedere con la conversione
   */
  canConvert(): boolean {
    return !!(
      this.selectedFile() &&
      this.sourceFormat() &&
      this.targetFormat() &&
      !this.isConverting()
    );
  }

  /**
   * Esegue la conversione
   */
  async convert(): Promise<void> {
    const file = this.selectedFile();
    const source = this.sourceFormat();
    const target = this.targetFormat();

    if (!file || !source || !target) return;

    this.isConverting.set(true);
    this.conversionProgress.set(10);

    try {
      // Simula progresso iniziale
      this.conversionProgress.set(30);

      // Esegui conversione
      const result = await this.converterService.convert(file, source, target, {
        quality: environment.conversion.defaultQuality,
      });

      this.conversionProgress.set(80);

      if (!result.success) {
        throw new Error(result.error || 'Conversion failed');
      }

      // Salva il file convertito
      await this.fileSystemService.saveFile(result.fileName!, result.blob!, result.mimeType!);

      this.conversionProgress.set(100);

      // Mostra successo
      await this.showSuccessAlert(result.fileName!, result.duration);

      // Reset stato
      this.resetState();
    } catch (error) {
      console.error('Conversion error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.showToast(`Conversion failed: ${message}`, 'danger');
    } finally {
      this.isConverting.set(false);
      this.conversionProgress.set(0);
    }
  }

  /**
   * Condividi il file convertito
   */
  async convertAndShare(): Promise<void> {
    const file = this.selectedFile();
    const source = this.sourceFormat();
    const target = this.targetFormat();

    if (!file || !source || !target) return;

    this.isConverting.set(true);

    try {
      const result = await this.converterService.convert(file, source, target);

      if (!result.success) {
        throw new Error(result.error || 'Conversion failed');
      }

      // Condividi il file
      await this.fileSystemService.shareFile(result.fileName!, result.blob!, result.mimeType!);

      await this.showToast('File shared successfully', 'success');
      this.resetState();
    } catch (error) {
      console.error('Share error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.showToast(`Failed to share: ${message}`, 'danger');
    } finally {
      this.isConverting.set(false);
    }
  }

  /**
   * Reset dello stato
   */
  private resetState(): void {
    this.selectedFile.set(null);
    this.sourceFormat.set(null);
    this.targetFormat.set(null);
    this.availableTargets.set([]);
  }

  /**
   * Mostra toast notification
   */
  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  /**
   * Mostra alert di successo
   */
  private async showSuccessAlert(fileName: string, duration?: number): Promise<void> {
    const durationText = duration ? ` in ${(duration / 1000).toFixed(2)}s` : '';

    const alert = await this.alertController.create({
      header: 'Conversion Successful',
      message: `File converted successfully${durationText}!<br><br><strong>${fileName}</strong>`,
      buttons: ['OK'],
    });

    await alert.present();
  }

  /**
   * Formatta la dimensione del file
   */
  formatFileSize(bytes: number): string {
    return this.fileSystemService.formatFileSize(bytes);
  }
}
