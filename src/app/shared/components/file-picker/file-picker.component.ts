import { Component, output, input, signal, viewChild, ElementRef, inject } from '@angular/core';

import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormatInfo, SUPPORTED_FORMATS } from '@core/models/conversion-format';

type FormatCategory = FormatInfo['category'];
type SizeLimitsByCategory = Partial<Record<FormatCategory, number>>;

/**
 * Component per selezionare file da convertire
 * Supporta drag & drop e click per selezione
 */
@Component({
  selector: 'app-file-picker',
  standalone: true,
  imports: [IonicModule, TranslateModule],
  templateUrl: './file-picker.component.html',
  styleUrls: ['./file-picker.component.scss'],
})
export class FilePickerComponent {
  private translate = inject(TranslateService);

  // Inputs
  accept = input<string>('*/*'); // Tipi di file accettati
  maxSize = input<number>(25 * 1024 * 1024); // Fallback globale
  maxSizeByCategory = input<SizeLimitsByCategory>({});
  multiple = input<boolean>(false); // Selezione multipla

  // Outputs
  fileSelected = output<File>();
  filesSelected = output<File[]>();
  fileError = output<string>();

  // State
  isDragging = signal(false);
  selectedFileName = signal<string | null>(null);

  // ViewChild
  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /**
   * Gestisce il click sul file picker
   */
  onPickerClick(): void {
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.click();
    }
  }

  /**
   * Gestisce il cambio di file dall'input
   */
  onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.handleFiles(Array.from(target.files));
    }
  }

  /**
   * Gestisce il drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  /**
   * Gestisce il drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  /**
   * Gestisce il drop dei file
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  /**
   * Processa i file selezionati
   */
  private handleFiles(files: File[]): void {
    // Valida dimensione file in base alla categoria del formato
    const invalidFile = files.find((file) => file.size > this.getMaxSizeForFile(file));
    if (invalidFile) {
      const maxSize = this.formatBytes(this.getMaxSizeForFile(invalidFile));
      const format = this.getFileTypeLabel(invalidFile);
      this.fileError.emit(
        this.translate.instant('FILE_PICKER.FILE_TOO_LARGE_FOR_TYPE', {
          format,
          maxSize,
        })
      );
      return;
    }

    // Emetti evento in base a single/multiple
    if (this.multiple()) {
      this.filesSelected.emit(files);
      this.selectedFileName.set(
        this.translate.instant('FILE_PICKER.FILES_SELECTED', { count: files.length })
      );
    } else {
      const file = files[0];
      this.fileSelected.emit(file);
      this.selectedFileName.set(file.name);
    }
  }

  /**
   * Reset del picker
   */
  reset(): void {
    this.selectedFileName.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  /**
   * Formatta la dimensione massima in modo leggibile
   */
  formatMaxSize(): string {
    const bytes = this.maxSize();
    return this.formatBytes(bytes);
  }

  private getMaxSizeForFile(file: File): number {
    const formatInfo = this.getFormatInfo(file);
    if (!formatInfo) {
      return this.maxSize();
    }

    return this.maxSizeByCategory()[formatInfo.category] ?? this.maxSize();
  }

  private getFormatInfo(file: File): FormatInfo | undefined {
    const fileName = file.name.toLowerCase();
    return SUPPORTED_FORMATS.find((format) =>
      format.extensions.some((extension) => fileName.endsWith(extension))
    );
  }

  private getFileTypeLabel(file: File): string {
    const extension = file.name.split('.').pop()?.toUpperCase();
    return extension || this.translate.instant('FILE_PICKER.THIS_FILE_TYPE');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
