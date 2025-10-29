import { Component, OnInit, OnDestroy, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, LoadingController } from '@ionic/angular';
import { ScannerService } from '@core/services/scanner.service';
import { OcrService } from '@core/services/ocr.service';
import { FileSystemService } from '@core/services/file-system.service';
import { ConverterService } from '@core/services/converter.service';
import { ErrorService } from '@core/services/error.service';
import { ConversionFormat } from '@core/models/conversion-format';
import { OcrLanguage } from '@core/models/scan-options';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '@env/environment';

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
  private readonly errorService = inject(ErrorService);
  private readonly loadingController = inject(LoadingController);
  private readonly destroyRef = inject(DestroyRef);

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

  // Scan workflow steps (signal for reactive state management)
  steps = signal<ScanStep[]>([
    { id: 'capture', label: 'Cattura', completed: false },
    { id: 'detect', label: 'Rilevamento', completed: false },
    { id: 'correct', label: 'Correzione', completed: false },
    { id: 'enhance', label: 'Miglioramento', completed: false },
    { id: 'ocr', label: 'OCR', completed: false },
    { id: 'preview', label: 'Anteprima', completed: false },
  ]);

  ngOnInit() {
    this.checkCameraAvailability();
  }

  ngOnDestroy() {
    // Terminate workers to free resources and prevent memory leaks
    this.scannerService.terminate();
    this.ocrService.terminate();
  }

  private async checkCameraAvailability() {
    const available = await this.scannerService.isCameraAvailable();
    if (!available) {
      await this.errorService.showWarning(
        'Fotocamera non disponibile. Usa il pulsante per caricare da galleria.'
      );
    }
  }

  /**
   * Start document scan from camera
   */
  async scanDocument() {
    await this.performScan(
      'camera',
      'Inizializzazione fotocamera...',
      'Documento scansionato con successo!'
    );
  }

  /**
   * Pick image from gallery
   */
  async pickFromGallery() {
    await this.performScan('photos', 'Caricamento immagine...', 'Immagine caricata e processata!');
  }

  /**
   * Unified method to perform document scanning from camera or gallery
   * Eliminates code duplication and centralizes scan logic
   */
  private async performScan(
    source: 'camera' | 'photos',
    loadingMessage: string,
    successMessage: string
  ) {
    this.isProcessing.set(true);
    this.resetSteps();

    const loading = await this.loadingController.create({
      message: loadingMessage,
    });
    await loading.present();

    try {
      // Subscribe to progress updates
      this.scannerService.progress$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((progress) => {
          const message = progress.message || 'Elaborazione in corso...';
          this.progressMessage.set(message);
          loading.message = message;

          // Update steps based on progress (only for camera capture)
          if (source === 'camera') {
            if (message.includes('Cattura')) this.markStepCompleted('capture');
            if (message.includes('Rilevamento')) this.markStepCompleted('detect');
            if (message.includes('Correzione')) this.markStepCompleted('correct');
            if (message.includes('Enhancement')) this.markStepCompleted('enhance');
          }
        });

      // Perform scan/load with the scanner service
      const result = await this.scannerService.scanDocument({
        source: source === 'photos' ? 'photos' : undefined,
        quality: environment.scanner.defaultQuality,
        resultType: 'base64',
      });

      if (result.success && result.data) {
        this.scannedImage.set(`data:image/jpeg;base64,${result.data}`);
        this.currentStep.set('preview');

        // Mark all steps completed
        if (source === 'photos') {
          // Gallery: mark all steps as completed immediately
          this.markStepCompleted('capture');
          this.markStepCompleted('detect');
          this.markStepCompleted('correct');
          this.markStepCompleted('enhance');
        }
        this.markStepCompleted('preview');

        await this.errorService.showSuccess(successMessage);
      } else {
        throw new Error(result.error || 'Operazione fallita');
      }
    } catch (error: any) {
      const errorMessage =
        source === 'camera' ? 'Errore durante la scansione' : 'Errore durante il caricamento';
      await this.errorService.handleError(error, 'Scanner', errorMessage);
      this.resetScan();
    } finally {
      await loading.dismiss();
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
      this.ocrService.progress$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((ocrProgress) => {
          const percent = Math.round(ocrProgress.progress * 100);
          loading.message = `Riconoscimento testo... ${percent}%`;
        });

      // Run OCR
      const result = await this.ocrService.recognizeText(blob, {
        language: this.selectedLanguage(),
      });

      if (result.success && result.text) {
        this.ocrText.set(result.text);
        this.markStepCompleted('ocr');

        await this.errorService.showSuccess(
          `OCR completato! Confidenza: ${Math.round((result.confidence || 0) * 100)}%`
        );
      } else {
        throw new Error(result.error || 'OCR fallito');
      }
    } catch (error: any) {
      await this.errorService.handleError(error, 'OCR', 'Errore OCR');
    } finally {
      await loading.dismiss();
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
      await this.errorService.showSuccess('Immagine salvata con successo!');
    } catch (error: any) {
      await this.errorService.handleError(error, 'Download Image', 'Errore durante il salvataggio');
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

        await this.errorService.showSuccess('PDF generato e salvato!');
      } else {
        throw new Error(result.error || 'Conversione PDF fallita');
      }
    } catch (error: any) {
      await this.errorService.handleError(error, 'PDF Generation', 'Errore generazione PDF');
    } finally {
      await loading.dismiss();
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
      await this.errorService.showSuccess('Testo salvato con successo!');
    } catch (error: any) {
      await this.errorService.handleError(error, 'Download Text', 'Errore durante il salvataggio');
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
      await this.errorService.handleError(error, 'Share Image', 'Errore durante la condivisione');
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
    this.steps.update((currentSteps) =>
      currentSteps.map((step) => ({ ...step, completed: false }))
    );
  }

  private markStepCompleted(stepId: ScanStep['id']) {
    this.steps.update((currentSteps) =>
      currentSteps.map((step) => (step.id === stepId ? { ...step, completed: true } : step))
    );
  }
}
