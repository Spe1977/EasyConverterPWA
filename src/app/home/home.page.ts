import { Component, signal, inject, OnDestroy, viewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  ConversionFormat,
  ConversionPreflightResult,
  ConversionReliability,
} from '@core/models/conversion-format';
import {
  ConversionCancelledError,
  ConversionTimeoutError,
  StructuredDataColumnNamingStrategy,
  StructuredDataPrimitiveArrayStrategy,
} from '@core/models/conversion-result';
import { ConverterService } from '@core/services/converter.service';
import { FileSystemService } from '@core/services/file-system.service';
import { FilePickerComponent } from '@app/shared/components/file-picker/file-picker.component';
import { ToastController, AlertController } from '@ionic/angular';
import { environment } from '@env/environment';

interface FilePreviewState {
  kind: 'text' | 'image' | 'unavailable';
  content?: string;
  imageUrl?: string;
  note?: string;
  truncated?: boolean;
  lineCount?: number;
  charCount?: number;
}

interface QualityFeedbackState {
  tone: 'good' | 'caution' | 'risk';
  title: string;
  detail: string;
  reliabilityLabel: string | null;
}

interface LastConversionFeedbackState {
  tone: 'good' | 'caution' | 'risk';
  title: string;
  detail: string;
  fileName: string;
  outputSize: string;
  duration: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  private converterService = inject(ConverterService);
  private fileSystemService = inject(FileSystemService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private translate = inject(TranslateService);

  constructor() {
    this.convertingFileMessage = this.translate.instant('CONVERSION.CONVERTING');
  }

  // State
  selectedFile = signal<File | null>(null);
  sourceFormat = signal<ConversionFormat | null>(null);
  targetFormat = signal<ConversionFormat | null>(null);
  isConverting = signal(false);
  conversionProgress = signal(0);
  availableTargets = signal<ConversionFormat[]>([]);
  errorMessage = signal<string | null>(null);
  detectedFormatHint = signal<string | null>(null);
  preflightMessage = signal<string | null>(null);
  preflightSeverity = signal<'warning' | 'danger' | null>(null);
  preflightBlocking = signal(false);
  filePreview = signal<FilePreviewState | null>(null);
  qualityFeedback = signal<QualityFeedbackState | null>(null);
  lastConversionFeedback = signal<LastConversionFeedbackState | null>(null);
  structuredDataCollectionPaths = signal<string[]>([]);
  selectedStructuredDataCollectionPath = signal<string | null>(null);
  structuredDataPrimitiveArrayStrategy = signal<StructuredDataPrimitiveArrayStrategy>('join');
  structuredDataColumnNaming = signal<StructuredDataColumnNamingStrategy>('dot');

  // Environment
  maxFileSize = environment.conversion.maxFileSize;
  maxFileSizes = environment.conversion.maxFileSizes;

  // i18n messages
  convertingFileMessage = '';

  // Timeout reference for cleanup
  private errorTimeoutId?: number;
  private preflightRequestId = 0;
  private conversionAbortController?: AbortController;
  private filePicker = viewChild(FilePickerComponent);
  private currentImageObjectUrl?: string;

  /**
   * Gestisce la selezione del file
   */
  async onFileSelected(file: File): Promise<void> {
    this.selectedFile.set(file);
    this.detectedFormatHint.set(null);
    this.clearPreflightState();
    this.qualityFeedback.set(null);

    const extensionFormat = this.converterService.detectFormat(file);

    // Rileva il formato reale del contenuto per correggere mismatch comuni
    const detectedFormat = await this.converterService.detectFormatFromContent(file);
    if (detectedFormat) {
      this.sourceFormat.set(detectedFormat);
      this.updateAvailableTargets(detectedFormat);
      await this.updateStructuredDataExportProfile(file, detectedFormat);
      await this.updateFilePreview(file, detectedFormat);

      if (extensionFormat && extensionFormat !== detectedFormat) {
        const hint = this.translate.instant('FORMAT_DETECTION.DETECTED_CONTENT', {
          format: detectedFormat.toUpperCase(),
          extension: extensionFormat,
        });
        this.detectedFormatHint.set(hint);
        this.showToast(hint, 'warning');
      }
    } else {
      this.showToast(this.translate.instant('FORMAT_DETECTION.COULD_NOT_DETECT'), 'warning');
      await this.updateFilePreview(file, null);
    }

    // Reset target se già selezionato
    this.targetFormat.set(null);
  }

  /**
   * Gestisce errori di file picker
   */
  onFileError(error: string): void {
    this.errorMessage.set(error);
    this.showToast(error, 'danger');
    // Clear any existing timeout
    if (this.errorTimeoutId !== undefined) {
      clearTimeout(this.errorTimeoutId);
    }
    // Clear error after 3 seconds
    this.errorTimeoutId = window.setTimeout(() => this.errorMessage.set(null), 3000);
  }

  /**
   * Gestisce cambio formato sorgente
   */
  onSourceFormatChange(format: ConversionFormat): void {
    this.sourceFormat.set(format);
    this.updateAvailableTargets(format);
    this.targetFormat.set(null); // Reset target
    this.clearPreflightState();
    this.qualityFeedback.set(null);
    void this.updateStructuredDataExportProfile(this.selectedFile(), format);
    void this.updateFilePreview(this.selectedFile(), format);
  }

  /**
   * Gestisce cambio formato destinazione
   */
  onTargetFormatChange(format: ConversionFormat): void {
    this.targetFormat.set(format);
    void this.updatePreflightValidation();
  }

  onStructuredDataCollectionPathChange(path: string | null): void {
    this.selectedStructuredDataCollectionPath.set(path);
    void this.updatePreflightValidation();
  }

  onStructuredDataPrimitiveArrayStrategyChange(
    strategy: StructuredDataPrimitiveArrayStrategy
  ): void {
    this.structuredDataPrimitiveArrayStrategy.set(strategy);
    void this.updatePreflightValidation();
  }

  onStructuredDataColumnNamingChange(strategy: StructuredDataColumnNamingStrategy): void {
    this.structuredDataColumnNaming.set(strategy);
    void this.updatePreflightValidation();
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
      !this.isConverting() &&
      !this.preflightBlocking()
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

    await this.updatePreflightValidation();
    if (this.preflightBlocking()) {
      return;
    }

    this.isConverting.set(true);
    this.conversionProgress.set(10);
    this.conversionAbortController = new AbortController();

    try {
      this.conversionProgress.set(30);

      const result = await this.converterService.convert(file, source, target, {
        quality: environment.conversion.defaultQuality,
        signal: this.conversionAbortController.signal,
        structuredData: this.getStructuredDataConversionOptions(),
      });

      this.conversionProgress.set(80);

      if (!result.success) {
        throw new Error(result.error || this.translate.instant('CONVERSION.FAILED_FALLBACK'));
      }

      await this.fileSystemService.saveFile(result.fileName!, result.blob!, result.mimeType!);

      this.conversionProgress.set(100);
      this.updateLastConversionFeedback(result);

      await this.showSuccessAlert(result.fileName!, result.duration);

      this.resetState();
    } catch (error) {
      console.error('Conversion error:', error);
      await this.showConversionError(error);
    } finally {
      this.isConverting.set(false);
      this.conversionProgress.set(0);
      this.conversionAbortController = undefined;
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

    await this.updatePreflightValidation();
    if (this.preflightBlocking()) {
      return;
    }

    this.isConverting.set(true);
    this.conversionAbortController = new AbortController();

    try {
      const result = await this.converterService.convert(file, source, target, {
        signal: this.conversionAbortController.signal,
        structuredData: this.getStructuredDataConversionOptions(),
      });

      if (!result.success) {
        throw new Error(result.error || this.translate.instant('CONVERSION.FAILED_FALLBACK'));
      }

      await this.fileSystemService.shareFile(result.fileName!, result.blob!, result.mimeType!);
      this.updateLastConversionFeedback(result);

      await this.showToast(this.translate.instant('CONVERSION.SHARE_SUCCESS'), 'success');
      this.resetState();
    } catch (error) {
      console.error('Share error:', error);
      const message =
        error instanceof Error ? error.message : this.translate.instant('CONVERSION.UNKNOWN_ERROR');
      await this.showToast(
        this.translate.instant('CONVERSION.SHARE_FAILED', { message }),
        'danger'
      );
    } finally {
      this.isConverting.set(false);
      this.conversionAbortController = undefined;
    }
  }

  cancelConversion(): void {
    this.conversionAbortController?.abort();
  }

  /**
   * Reset dello stato
   */
  private resetState(): void {
    this.filePicker()?.reset();
    this.selectedFile.set(null);
    this.sourceFormat.set(null);
    this.targetFormat.set(null);
    this.availableTargets.set([]);
    this.detectedFormatHint.set(null);
    this.revokeCurrentImageUrl();
    this.filePreview.set(null);
    this.qualityFeedback.set(null);
    this.resetStructuredDataOptions();
    this.clearPreflightState();
  }

  private clearPreflightState(): void {
    this.preflightMessage.set(null);
    this.preflightSeverity.set(null);
    this.preflightBlocking.set(false);
  }

  private async updatePreflightValidation(): Promise<void> {
    const file = this.selectedFile();
    const source = this.sourceFormat();
    const target = this.targetFormat();

    if (!file || !source || !target) {
      this.clearPreflightState();
      return;
    }

    const requestId = ++this.preflightRequestId;
    const validation = await this.converterService.validateConversion(file, source, target, {
      structuredData: this.getStructuredDataConversionOptions(),
    });

    if (requestId !== this.preflightRequestId) {
      return;
    }

    this.applyPreflightValidation(validation);
  }

  private applyPreflightValidation(validation: ConversionPreflightResult): void {
    this.preflightBlocking.set(validation.blocking);
    this.preflightSeverity.set(validation.severity);
    this.preflightMessage.set(
      validation.messageKey ? this.translate.instant(validation.messageKey) : null
    );
    this.updateQualityFeedback(validation);
  }

  private async updateFilePreview(
    file: File | null,
    format: ConversionFormat | null
  ): Promise<void> {
    if (!file) {
      this.filePreview.set(null);
      return;
    }

    if (format && this.isImageFormat(format)) {
      this.revokeCurrentImageUrl();
      const imageUrl = URL.createObjectURL(file);
      this.currentImageObjectUrl = imageUrl;
      this.filePreview.set({
        kind: 'image',
        imageUrl,
        note: this.translate.instant('FILE_PREVIEW.IMAGE_NOTE'),
      });
      return;
    }

    if (!format || !this.isTextPreviewFormat(format)) {
      this.filePreview.set({
        kind: 'unavailable',
        note: this.translate.instant('FILE_PREVIEW.UNAVAILABLE_NOTE'),
      });
      return;
    }

    const rawText = await this.fileSystemService.readFileAsText(file);
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    const maxChars = 1200;
    const content = normalized.slice(0, maxChars);

    this.filePreview.set({
      kind: 'text',
      content,
      truncated: normalized.length > maxChars,
      lineCount: normalized ? normalized.split('\n').length : 0,
      charCount: normalized.length,
    });
  }

  private updateQualityFeedback(validation: ConversionPreflightResult | null): void {
    const source = this.sourceFormat();
    const target = this.targetFormat();
    const support = this.converterService.getConversionSupport(source, target);

    if (!support || !validation) {
      this.qualityFeedback.set(null);
      return;
    }

    const reliabilityLabel = this.getReliabilityLabel(support.reliability);

    if (validation.blocking) {
      this.qualityFeedback.set({
        tone: 'risk',
        title: this.translate.instant('QUALITY_FEEDBACK.BLOCKING_TITLE'),
        detail:
          this.preflightMessage() ?? this.translate.instant('QUALITY_FEEDBACK.BLOCKING_DETAIL'),
        reliabilityLabel,
      });
      return;
    }

    if (this.preflightMessage()) {
      this.qualityFeedback.set({
        tone: validation.severity === 'danger' ? 'risk' : 'caution',
        title: this.translate.instant('QUALITY_FEEDBACK.REVIEW_TITLE'),
        detail: this.preflightMessage()!,
        reliabilityLabel,
      });
      return;
    }

    this.qualityFeedback.set(this.getDefaultQualityFeedback(support.reliability, reliabilityLabel));
  }

  private getDefaultQualityFeedback(
    reliability: ConversionReliability,
    reliabilityLabel: string | null
  ): QualityFeedbackState {
    const feedbackByReliability: Record<ConversionReliability, QualityFeedbackState> = {
      lossless: {
        tone: 'good',
        title: this.translate.instant('QUALITY_FEEDBACK.LOSSLESS_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.LOSSLESS_DETAIL'),
        reliabilityLabel,
      },
      structured: {
        tone: 'good',
        title: this.translate.instant('QUALITY_FEEDBACK.STRUCTURED_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.STRUCTURED_DETAIL'),
        reliabilityLabel,
      },
      'text-only': {
        tone: 'caution',
        title: this.translate.instant('QUALITY_FEEDBACK.TEXT_ONLY_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.TEXT_ONLY_DETAIL'),
        reliabilityLabel,
      },
      'best-effort': {
        tone: 'caution',
        title: this.translate.instant('QUALITY_FEEDBACK.BEST_EFFORT_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.BEST_EFFORT_DETAIL'),
        reliabilityLabel,
      },
      'table-only': {
        tone: 'caution',
        title: this.translate.instant('QUALITY_FEEDBACK.TABLE_ONLY_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.TABLE_ONLY_DETAIL'),
        reliabilityLabel,
      },
      'requires-uniform-data': {
        tone: 'caution',
        title: this.translate.instant('QUALITY_FEEDBACK.UNIFORM_DATA_TITLE'),
        detail: this.translate.instant('QUALITY_FEEDBACK.UNIFORM_DATA_DETAIL'),
        reliabilityLabel,
      },
    };

    return feedbackByReliability[reliability];
  }

  private updateLastConversionFeedback(result: {
    fileName?: string;
    size?: number;
    duration?: number;
  }): void {
    const qualityFeedback = this.qualityFeedback();

    this.lastConversionFeedback.set({
      tone: qualityFeedback?.tone ?? 'good',
      title: this.translate.instant('QUALITY_FEEDBACK.RESULT_TITLE'),
      detail: qualityFeedback?.detail ?? this.translate.instant('QUALITY_FEEDBACK.RESULT_DETAIL'),
      fileName: result.fileName ?? '',
      outputSize: this.formatFileSize(result.size ?? 0),
      duration: result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'n/a',
    });
  }

  private getReliabilityLabel(reliability: ConversionReliability): string | null {
    const labelMap: Record<ConversionReliability, string> = {
      lossless: this.translate.instant('CONVERSION_RELIABILITY.LOSSLESS'),
      structured: this.translate.instant('CONVERSION_RELIABILITY.STRUCTURED'),
      'text-only': this.translate.instant('CONVERSION_RELIABILITY.TEXT-ONLY'),
      'best-effort': this.translate.instant('CONVERSION_RELIABILITY.BEST-EFFORT'),
      'table-only': this.translate.instant('CONVERSION_RELIABILITY.TABLE-ONLY'),
      'requires-uniform-data': this.translate.instant(
        'CONVERSION_RELIABILITY.REQUIRES-UNIFORM-DATA'
      ),
    };

    return labelMap[reliability] ?? null;
  }

  private isTextPreviewFormat(format: ConversionFormat): boolean {
    return [
      ConversionFormat.TXT,
      ConversionFormat.MD,
      ConversionFormat.HTML,
      ConversionFormat.RTF,
      ConversionFormat.CSV,
      ConversionFormat.JSON,
      ConversionFormat.XML,
      ConversionFormat.YAML,
      ConversionFormat.BASE64,
    ].includes(format);
  }

  private isImageFormat(format: ConversionFormat): boolean {
    return [
      ConversionFormat.PNG,
      ConversionFormat.JPEG,
      ConversionFormat.JPG,
      ConversionFormat.WEBP,
    ].includes(format);
  }

  showStructuredDataOptions(): boolean {
    const source = this.sourceFormat();
    const target = this.targetFormat();

    return (
      !!this.selectedFile() &&
      !!source &&
      !!target &&
      [ConversionFormat.JSON, ConversionFormat.XML].includes(source) &&
      [ConversionFormat.CSV, ConversionFormat.XLSX, ConversionFormat.HTML].includes(target)
    );
  }

  hasStructuredDataCollectionChoices(): boolean {
    return this.structuredDataCollectionPaths().length > 0;
  }

  private async updateStructuredDataExportProfile(
    file: File | null,
    sourceFormat: ConversionFormat | null
  ): Promise<void> {
    if (
      !file ||
      !sourceFormat ||
      ![ConversionFormat.JSON, ConversionFormat.XML].includes(sourceFormat)
    ) {
      this.resetStructuredDataOptions();
      return;
    }

    const profile = await this.converterService.getStructuredDataExportProfile(file, sourceFormat);
    this.structuredDataCollectionPaths.set(profile?.collectionPaths ?? []);
    this.selectedStructuredDataCollectionPath.set(profile?.defaultOptions.collectionPath ?? null);
    this.structuredDataPrimitiveArrayStrategy.set(
      profile?.defaultOptions.primitiveArrayStrategy ?? 'join'
    );
    this.structuredDataColumnNaming.set(profile?.defaultOptions.columnNaming ?? 'dot');
  }

  private resetStructuredDataOptions(): void {
    this.structuredDataCollectionPaths.set([]);
    this.selectedStructuredDataCollectionPath.set(null);
    this.structuredDataPrimitiveArrayStrategy.set('join');
    this.structuredDataColumnNaming.set('dot');
  }

  private getStructuredDataConversionOptions() {
    return {
      collectionPath: this.selectedStructuredDataCollectionPath(),
      primitiveArrayStrategy: this.structuredDataPrimitiveArrayStrategy(),
      columnNaming: this.structuredDataColumnNaming(),
    };
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
    const message = duration
      ? this.translate.instant('CONVERSION.SUCCESS_MESSAGE', {
          duration: `${(duration / 1000).toFixed(2)}s`,
          fileName,
        })
      : this.translate.instant('CONVERSION.SUCCESS_MESSAGE_NO_DURATION', { fileName });

    const alert = await this.alertController.create({
      header: this.translate.instant('CONVERSION.SUCCESS_HEADER'),
      message,
      buttons: [this.translate.instant('CONVERSION.SUCCESS_OK')],
    });

    await alert.present();
  }

  /**
   * Mostra errore conversione con gestione timeout/cancellazione
   */
  private async showConversionError(error: unknown): Promise<void> {
    if (error instanceof ConversionTimeoutError) {
      await this.showToast(this.translate.instant('CONVERSION.TIMEOUT'), 'danger');
    } else if (error instanceof ConversionCancelledError) {
      await this.showToast(this.translate.instant('CONVERSION.CANCELLED'), 'warning');
    } else {
      const message =
        error instanceof Error ? error.message : this.translate.instant('CONVERSION.UNKNOWN_ERROR');
      await this.showToast(this.translate.instant('CONVERSION.FAILED', { message }), 'danger');
    }
  }

  /**
   * Formatta la dimensione del file
   */
  formatFileSize(bytes: number): string {
    return this.fileSystemService.formatFileSize(bytes);
  }

  /**
   * Cleanup when component is destroyed
   */
  ngOnDestroy(): void {
    if (this.errorTimeoutId !== undefined) {
      clearTimeout(this.errorTimeoutId);
    }
    this.revokeCurrentImageUrl();
  }

  private revokeCurrentImageUrl(): void {
    if (this.currentImageObjectUrl) {
      URL.revokeObjectURL(this.currentImageObjectUrl);
      this.currentImageObjectUrl = undefined;
    }
  }
}
