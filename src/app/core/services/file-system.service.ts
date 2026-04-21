import { Injectable, OnDestroy } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Service per gestire operazioni su file system utilizzando Capacitor
 * Supporta sia piattaforme native (iOS/Android) che web
 */
@Injectable({
  providedIn: 'root',
})
export class FileSystemService implements OnDestroy {
  private cleanupTimeouts = new Set<number>();

  /**
   * Verifica se l'app è in esecuzione su piattaforma native
   */
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Salva un file sul dispositivo
   * @param fileName Nome del file da salvare
   * @param blob Contenuto del file come Blob
   * @param mimeType Tipo MIME del file
   * @returns Path del file salvato (solo su native)
   */
  async saveFile(fileName: string, blob: Blob, mimeType: string): Promise<string | null> {
    if (this.isNative) {
      return this.saveFileNative(fileName, blob);
    } else {
      return this.saveFileWeb(fileName, blob, mimeType);
    }
  }

  /**
   * Salva file su piattaforma native usando Capacitor Filesystem
   */
  private async saveFileNative(fileName: string, blob: Blob): Promise<string> {
    // Converti Blob in base64
    const base64Data = await this.blobToBase64(blob);

    // Rimuovi il prefixo "data:*/*;base64," se presente
    const base64Clean = base64Data.split(',')[1] || base64Data;

    // Salva il file
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Clean,
      directory: Directory.Documents,
    });

    return result.uri;
  }

  /**
   * Salva file su web usando download automatico
   */
  private saveFileWeb(fileName: string, blob: Blob, mimeType: string): null {
    const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return null;
  }

  /**
   * Legge un file come testo.
   * Rimuove il BOM UTF-8 iniziale (U+FEFF) se presente: FileReader non lo
   * strappa in modo affidabile su tutti i browser e, se lasciato, si
   * trascina nella prima cella dei CSV o nella prima riga dei MD/HTML.
   * @param file File da leggere
   * @returns Contenuto del file come stringa
   */
  async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        resolve(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as text'));
      reader.onabort = () => reject(new Error('File read aborted'));
      reader.readAsText(file);
    });
  }

  /**
   * Legge un file come ArrayBuffer
   * @param file File da leggere
   * @returns Contenuto del file come ArrayBuffer
   */
  async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error ?? new Error('Failed to read file as ArrayBuffer'));
      reader.onabort = () => reject(new Error('File read aborted'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Legge un file come Data URL (base64)
   * @param file File da leggere
   * @returns Contenuto del file come data URL
   */
  async readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as data URL'));
      reader.onabort = () => reject(new Error('File read aborted'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Condivide un file usando il native share dialog
   * @param fileName Nome del file da condividere
   * @param blob Contenuto del file
   * @param mimeType Tipo MIME del file
   */
  async shareFile(fileName: string, blob: Blob, mimeType: string): Promise<void> {
    if (!this.isNative) {
      // Su web, usa Web Share API se disponibile
      if (navigator.share) {
        const file = new File([blob], fileName, { type: mimeType });
        await navigator.share({
          files: [file],
          title: fileName,
        });
      } else {
        // Fallback: download del file
        await this.saveFile(fileName, blob, mimeType);
      }
      return;
    }

    // Su native, salva temporaneamente e poi condividi
    const base64Data = await this.blobToBase64(blob);
    const base64Clean = base64Data.split(',')[1] || base64Data;

    // Salva in cache temporanea
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Clean,
      directory: Directory.Cache,
    });

    // Condividi usando Capacitor Share
    await Share.share({
      title: fileName,
      text: `Sharing ${fileName}`,
      url: result.uri,
      dialogTitle: 'Share file',
    });

    // Cleanup: rimuovi file temporaneo dopo condivisione
    const timeoutId = window.setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
        // Remove from tracked timeouts after execution
        this.cleanupTimeouts.delete(timeoutId);
      } catch (error) {
        console.warn('Failed to cleanup temp file:', error);
        this.cleanupTimeouts.delete(timeoutId);
      }
    }, 5000);

    // Track timeout for cleanup if service is destroyed
    this.cleanupTimeouts.add(timeoutId);
  }

  /**
   * Converte un Blob in stringa base64
   * @param blob Blob da convertire
   * @returns Stringa base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to encode blob as base64'));
      reader.onabort = () => reject(new Error('Blob read aborted'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Converte una stringa base64 in Blob
   * @param base64 Stringa base64
   * @param mimeType Tipo MIME del blob
   * @returns Blob
   */
  base64ToBlob(base64: string, mimeType: string): Blob {
    // Rimuovi prefisso se presente
    const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;

    const byteCharacters = atob(base64Clean);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays as BlobPart[], { type: mimeType });
  }

  /**
   * Ottieni la dimensione di un file in bytes
   * @param file File da misurare
   * @returns Dimensione in bytes
   */
  getFileSize(file: File): number {
    return file.size;
  }

  /**
   * Formatta la dimensione del file in modo leggibile
   * @param bytes Dimensione in bytes
   * @returns Stringa formattata (es: "1.5 MB")
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  /**
   * Verifica se la dimensione del file è entro i limiti
   * @param file File da verificare
   * @param maxSizeBytes Dimensione massima in bytes
   * @returns true se il file è valido
   */
  validateFileSize(file: File, maxSizeBytes: number): boolean {
    return file.size <= maxSizeBytes;
  }

  /**
   * Cleanup when service is destroyed
   * Clear all pending cleanup timeouts
   */
  ngOnDestroy(): void {
    // Clear all tracked timeouts
    this.cleanupTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.cleanupTimeouts.clear();
  }
}
