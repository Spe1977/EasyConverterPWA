import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { ScannerService } from '@core/services/scanner.service';
import { OcrService } from '@core/services/ocr.service';
import { FileSystemService } from '@core/services/file-system.service';
import { ConverterService } from '@core/services/converter.service';
import { ConversionFormat } from '@core/models/conversion-format';
import { OcrLanguage } from '@core/models/scan-options';
import { Subscription } from 'rxjs';

interface ScanStep {
  id: 'capture' | 'detect' | 'correct' | 'enhance' | 'ocr' | 'preview';
  label: string;
  completed: boolean;
}

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class ScannerPage implements OnInit, OnDestroy {
  private readonly scannerService = inject(ScannerService);
  private readonly ocrService = inject(OcrService);
  private readonly fileSystemService = inject(FileSystemService);
  private readonly converterService = inject(ConverterService);
  private readonly toastController = inject(ToastController);
  private readonly loadingController = inject(LoadingController);
  private readonly alertController = inject(AlertController);

  // Signals for reactive state
  currentStep = signal<ScanStep['id']>('capture');
  scannedImage = signal<string | null>(null);
  ocrText = signal<string | null>(null);
  selectedLanguage = signal<OcrLanguage>('ita');
  isProcessing = signal<boolean>(false);
  progressMessage = signal<string>('');

  // Available OCR languages
  readonly availableLanguages: { code: OcrLanguage; name: string }[] = [
    { code: 'ita', name: 'Italiano' },
    { code: 'eng', name: 'English' },
    { code: 'fra', name: 'Français' },
    { code: 'deu', name: 'Deutsch' },
    { code: 'spa', name: 'Español' },
    { code: 'por', name: 'Português' },
    { code: 'rus', name: 'Русский' },
    { code: 'chi_sim', name: '中文简体' },
  ];

  // Scan workflow steps
  steps: ScanStep[] = [
    { id: 'capture', label: 'Cattura', completed: false },
    { id: 'detect', label: 'Rilevamento', completed: false },
    { id: 'correct', label: 'Correzione', completed: false },
    { id: 'enhance', label: 'Miglioramento', completed: false },
    { id: 'ocr', label: 'OCR', completed: false },
    { id: 'preview', label: 'Anteprima', completed: false },
  ];

  private subscriptions = new Subscription();

  ngOnInit() {
    this.checkCameraAvailability();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private async checkCameraAvailability() {
    const available = await this.scannerService.isCameraAvailable();
    if (!available) {
      const toast = await this.toastController.create({
        message: 'Fotocamera non disponibile. Usa il pulsante per caricare da galleria.',
        duration: 3000,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
    }
  }

  /**
   * Start document scan from camera
   */
  async scanDocument() {
    this.isProcessing.set(true);
    this.resetSteps();

    const loading = await this.loadingController.create({
      message: 'Inizializzazione fotocamera...',
    });
    await loading.present();

    try {
      // Subscribe to progress updates
      const progressSub = this.scannerService.progress$.subscribe((progress) => {
        const message = progress.message || 'Elaborazione in corso...';
        this.progressMessage.set(message);
        loading.message = message;

        // Update steps based on progress
        if (message.includes('Cattura')) this.markStepCompleted('capture');
        if (message.includes('Rilevamento')) this.markStepCompleted('detect');
        if (message.includes('Correzione')) this.markStepCompleted('correct');
        if (message.includes('Enhancement')) this.markStepCompleted('enhance');
      });
      this.subscriptions.add(progressSub);

      // Scan document with edge detection and enhancement
      const result = await this.scannerService.scanDocument({
        quality: 100,
        resultType: 'base64',
      });

      if (result.success && result.data) {
        this.scannedImage.set(`data:image/jpeg;base64,${result.data}`);
        this.currentStep.set('preview');
        this.markStepCompleted('preview');

        await loading.dismiss();
        await this.showToast('Documento scansionato con successo!', 'success');
      } else {
        throw new Error(result.error || 'Scansione fallita');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('Scan error:', error);
      await this.showToast(`Errore durante la scansione: ${error.message}`, 'danger');
      this.resetScan();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Pick image from gallery
   */
  async pickFromGallery() {
    this.isProcessing.set(true);
    this.resetSteps();

    const loading = await this.loadingController.create({
      message: 'Caricamento immagine...',
    });
    await loading.present();

    try {
      // Subscribe to progress updates
      const progressSub = this.scannerService.progress$.subscribe((progress) => {
        const message = progress.message || 'Elaborazione in corso...';
        this.progressMessage.set(message);
        loading.message = message;
      });
      this.subscriptions.add(progressSub);

      // Pick and process image from gallery
      const result = await this.scannerService.scanDocument({
        source: 'photos',
        quality: 100,
        resultType: 'base64',
      });

      if (result.success && result.data) {
        this.scannedImage.set(`data:image/jpeg;base64,${result.data}`);
        this.currentStep.set('preview');
        this.markStepCompleted('capture');
        this.markStepCompleted('detect');
        this.markStepCompleted('correct');
        this.markStepCompleted('enhance');
        this.markStepCompleted('preview');

        await loading.dismiss();
        await this.showToast('Immagine caricata e processata!', 'success');
      } else {
        throw new Error(result.error || 'Caricamento fallito');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('Gallery pick error:', error);
      await this.showToast(`Errore durante il caricamento: ${error.message}`, 'danger');
      this.resetScan();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Run OCR on scanned image
   */
  async runOcr() {
    if (!this.scannedImage()) return;

    this.isProcessing.set(true);
    const loading = await this.loadingController.create({
      message: 'Inizializzazione OCR...',
    });
    await loading.present();

    try {
      // Convert base64 to Blob
      const base64Data = this.scannedImage()!.split(',')[1];
      const blob = this.fileSystemService.base64ToBlob(base64Data, 'image/jpeg');

      // Subscribe to OCR progress
      const progressSub = this.ocrService.progress$.subscribe((ocrProgress) => {
        const percent = Math.round(ocrProgress.progress * 100);
        loading.message = `Riconoscimento testo... ${percent}%`;
      });
      this.subscriptions.add(progressSub);

      // Run OCR
      const result = await this.ocrService.recognizeText(blob, {
        language: this.selectedLanguage(),
      });

      if (result.success && result.text) {
        this.ocrText.set(result.text);
        this.markStepCompleted('ocr');

        await loading.dismiss();
        await this.showSuccessAlert(
          'OCR completato!',
          `Testo riconosciuto con confidenza: ${Math.round((result.confidence || 0) * 100)}%`
        );
      } else {
        throw new Error(result.error || 'OCR fallito');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('OCR error:', error);
      await this.showToast(`Errore OCR: ${error.message}`, 'danger');
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Download scanned image as PNG
   */
  async downloadImage() {
    if (!this.scannedImage()) return;

    try {
      const base64Data = this.scannedImage()!.split(',')[1];
      const blob = this.fileSystemService.base64ToBlob(base64Data, 'image/png');
      const fileName = `scan_${Date.now()}.png`;

      await this.fileSystemService.saveFile(fileName, blob, 'image/png');
      await this.showToast('Immagine salvata con successo!', 'success');
    } catch (error: any) {
      console.error('Download error:', error);
      await this.showToast(`Errore durante il salvataggio: ${error.message}`, 'danger');
    }
  }

  /**
   * Download OCR text as PDF
   */
  async downloadPdf() {
    if (!this.ocrText()) return;

    this.isProcessing.set(true);
    const loading = await this.loadingController.create({
      message: 'Generazione PDF...',
    });
    await loading.present();

    try {
      // Create a File object from text
      const textFile = new File([this.ocrText()!], 'temp.txt', { type: 'text/plain' });

      // Convert text to PDF using ConverterService
      const result = await this.converterService.convert(
        textFile,
        ConversionFormat.TXT,
        ConversionFormat.PDF
      );

      if (result.success && result.blob) {
        const fileName = `scan_ocr_${Date.now()}.pdf`;
        await this.fileSystemService.saveFile(fileName, result.blob, 'application/pdf');

        await loading.dismiss();
        await this.showToast('PDF generato e salvato!', 'success');
      } else {
        throw new Error(result.error || 'Conversione PDF fallita');
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('PDF generation error:', error);
      await this.showToast(`Errore generazione PDF: ${error.message}`, 'danger');
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Download OCR text as TXT
   */
  async downloadText() {
    if (!this.ocrText()) return;

    try {
      const blob = new Blob([this.ocrText()!], { type: 'text/plain' });
      const fileName = `scan_ocr_${Date.now()}.txt`;

      await this.fileSystemService.saveFile(fileName, blob, 'text/plain');
      await this.showToast('Testo salvato con successo!', 'success');
    } catch (error: any) {
      console.error('Download text error:', error);
      await this.showToast(`Errore durante il salvataggio: ${error.message}`, 'danger');
    }
  }

  /**
   * Share scanned image
   */
  async shareImage() {
    if (!this.scannedImage()) return;

    try {
      const base64Data = this.scannedImage()!.split(',')[1];
      const blob = this.fileSystemService.base64ToBlob(base64Data, 'image/png');
      const fileName = `scan_${Date.now()}.png`;

      await this.fileSystemService.shareFile(fileName, blob, 'image/png');
    } catch (error: any) {
      console.error('Share error:', error);
      await this.showToast(`Errore durante la condivisione: ${error.message}`, 'danger');
    }
  }

  /**
   * Reset scan and start over
   */
  resetScan() {
    this.scannedImage.set(null);
    this.ocrText.set(null);
    this.currentStep.set('capture');
    this.progressMessage.set('');
    this.resetSteps();
  }

  private resetSteps() {
    this.steps.forEach((step) => (step.completed = false));
  }

  private markStepCompleted(stepId: ScanStep['id']) {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) step.completed = true;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private async showSuccessAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
