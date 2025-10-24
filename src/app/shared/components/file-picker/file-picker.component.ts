import { Component, output, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ConversionFormat } from '@core/models/conversion-format';

/**
 * Component per selezionare file da convertire
 * Supporta drag & drop e click per selezione
 */
@Component({
  selector: 'app-file-picker',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './file-picker.component.html',
  styleUrls: ['./file-picker.component.scss'],
})
export class FilePickerComponent {
  // Inputs
  accept = input<string>('*/*'); // Tipi di file accettati
  maxSize = input<number>(50 * 1024 * 1024); // 50MB default
  multiple = input<boolean>(false); // Selezione multipla

  // Outputs
  fileSelected = output<File>();
  filesSelected = output<File[]>();
  fileError = output<string>();

  // State
  isDragging = signal(false);
  selectedFileName = signal<string | null>(null);

  /**
   * Gestisce il click sul file picker
   */
  onPickerClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.accept();
    input.multiple = this.multiple();

    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.handleFiles(Array.from(target.files));
      }
    };

    input.click();
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
    // Valida dimensione file
    const invalidFiles = files.filter((f) => f.size > this.maxSize());
    if (invalidFiles.length > 0) {
      const maxSizeMB = (this.maxSize() / (1024 * 1024)).toFixed(0);
      this.fileError.emit(`File too large. Maximum size: ${maxSizeMB}MB`);
      return;
    }

    // Emetti evento in base a single/multiple
    if (this.multiple()) {
      this.filesSelected.emit(files);
      this.selectedFileName.set(`${files.length} file(s) selected`);
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
  }

  /**
   * Formatta la dimensione massima in modo leggibile
   */
  formatMaxSize(): string {
    const bytes = this.maxSize();
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
