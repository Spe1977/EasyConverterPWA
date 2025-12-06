import { Injectable } from '@angular/core';
import { ConversionFormat } from '@core/models/conversion-format';

/**
 * Service per elaborazione e conversione di immagini
 * Gestisce conversioni tra formati, resize, crop e ottimizzazioni
 */
@Injectable({
  providedIn: 'root',
})
export class ImageService {
  /**
   * Converte un'immagine in un formato diverso con qualità adattiva opzionale
   * @param file File immagine originale
   * @param targetFormat Formato di destinazione
   * @param quality Qualità output (0-100), se null usa qualità adattiva
   * @param preserveExif Se true, preserva metadati EXIF (solo JPEG)
   * @returns Blob dell'immagine convertita
   */
  async convertImage(
    file: File,
    targetFormat: ConversionFormat,
    quality: number | null = 85,
    preserveExif: boolean = false
  ): Promise<Blob> {
    const img = await this.loadImage(file);
    const canvas = this.createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    // Calcola qualità adattiva se non specificata
    const finalQuality = quality ?? this.calculateAdaptiveQuality(file.size);

    let blob = await this.canvasToBlob(canvas, targetFormat, finalQuality);

    // Preserva EXIF se richiesto (solo JPEG)
    if (preserveExif && targetFormat === ConversionFormat.JPEG) {
      blob = await this.preserveExifData(file, blob);
    }

    return blob;
  }

  /**
   * Calcola qualità adattiva basata sulla dimensione del file originale
   * File grandi usano qualità più bassa per ridurre dimensione
   * @param fileSize Dimensione file in bytes
   * @returns Qualità ottimale (0-100)
   */
  private calculateAdaptiveQuality(fileSize: number): number {
    const MB = 1024 * 1024;

    if (fileSize > 2 * MB) {
      // File > 2MB: qualità 70%
      return 70;
    } else if (fileSize > 500 * 1024 && fileSize <= 2 * MB) {
      // File 500KB-2MB: qualità 85%
      return 85;
    } else {
      // File < 500KB: qualità 95%
      return 95;
    }
  }

  /**
   * Preserva metadati EXIF da un'immagine sorgente a un'immagine di destinazione
   * @param sourceFile File immagine originale con EXIF
   * @param targetBlob Blob immagine convertita
   * @returns Blob con EXIF preservati
   */
  private async preserveExifData(sourceFile: File, targetBlob: Blob): Promise<Blob> {
    try {
      // Import piexifjs dinamicamente
      const piexif = await import('piexifjs') as any;

      // Leggi EXIF da source
      const sourceArrayBuffer = await sourceFile.arrayBuffer();
      const sourceDataUrl = this.arrayBufferToDataURL(sourceArrayBuffer, sourceFile.type);
      let exifObj: any;

      try {
        exifObj = piexif.load(sourceDataUrl);
      } catch (e) {
        // Nessun EXIF nel file sorgente, ritorna blob originale
        return targetBlob;
      }

      // Leggi target blob
      const targetArrayBuffer = await targetBlob.arrayBuffer();
      const targetDataUrl = this.arrayBufferToDataURL(targetArrayBuffer, targetBlob.type);

      // Inserisci EXIF nel target
      const exifBytes = piexif.dump(exifObj);
      const newDataUrl = piexif.insert(exifBytes, targetDataUrl);

      // Converti back to Blob
      return this.dataURLtoBlob(newDataUrl);
    } catch (error) {
      // Se fallisce, ritorna blob originale (senza EXIF)
      console.warn('Failed to preserve EXIF data:', error);
      return targetBlob;
    }
  }

  /**
   * Converte ArrayBuffer in Data URL
   */
  private arrayBufferToDataURL(buffer: ArrayBuffer, mimeType: string): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Ridimensiona un'immagine mantenendo le proporzioni
   * @param file File immagine originale
   * @param maxWidth Larghezza massima
   * @param maxHeight Altezza massima
   * @param quality Qualità output
   * @returns Blob dell'immagine ridimensionata
   */
  async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number = 85
  ): Promise<Blob> {
    const img = await this.loadImage(file);
    const { width, height } = this.calculateDimensions(img.width, img.height, maxWidth, maxHeight);

    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    // Usa il formato originale dell'immagine
    const format = this.detectImageFormat(file);
    return this.canvasToBlob(canvas, format, quality);
  }

  /**
   * Taglia un'immagine in base a coordinate specifiche
   * @param file File immagine originale
   * @param x Coordinata X di inizio
   * @param y Coordinata Y di inizio
   * @param width Larghezza del crop
   * @param height Altezza del crop
   * @param quality Qualità output
   * @returns Blob dell'immagine tagliata
   */
  async cropImage(
    file: File,
    x: number,
    y: number,
    width: number,
    height: number,
    quality: number = 85
  ): Promise<Blob> {
    const img = await this.loadImage(file);
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

    const format = this.detectImageFormat(file);
    return this.canvasToBlob(canvas, format, quality);
  }

  /**
   * Ruota un'immagine di un angolo specifico
   * @param file File immagine originale
   * @param degrees Angoli di rotazione (90, 180, 270)
   * @param quality Qualità output
   * @returns Blob dell'immagine ruotata
   */
  async rotateImage(file: File, degrees: 90 | 180 | 270, quality: number = 85): Promise<Blob> {
    const img = await this.loadImage(file);

    // Per rotazioni di 90 e 270 gradi, scambia larghezza e altezza
    const canvas =
      degrees === 90 || degrees === 270
        ? this.createCanvas(img.height, img.width)
        : this.createCanvas(img.width, img.height);

    const ctx = canvas.getContext('2d')!;

    // Muovi l'origine al centro del canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Ruota
    ctx.rotate((degrees * Math.PI) / 180);

    // Disegna l'immagine centrata
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const format = this.detectImageFormat(file);
    return this.canvasToBlob(canvas, format, quality);
  }

  /**
   * Converte un'immagine in grayscale
   * @param file File immagine originale
   * @param quality Qualità output
   * @returns Blob dell'immagine in bianco e nero
   */
  async toGrayscale(file: File, quality: number = 85): Promise<Blob> {
    const img = await this.loadImage(file);
    const canvas = this.createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // R
      data[i + 1] = avg; // G
      data[i + 2] = avg; // B
    }

    ctx.putImageData(imageData, 0, 0);

    const format = this.detectImageFormat(file);
    return this.canvasToBlob(canvas, format, quality);
  }

  /**
   * Applica un filtro di contrasto all'immagine
   * @param file File immagine originale
   * @param contrast Valore di contrasto (-100 a 100)
   * @param quality Qualità output
   * @returns Blob dell'immagine con contrasto modificato
   */
  async adjustContrast(file: File, contrast: number, quality: number = 85): Promise<Blob> {
    const img = await this.loadImage(file);
    const canvas = this.createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d')!;

    ctx.filter = `contrast(${100 + contrast}%)`;
    ctx.drawImage(img, 0, 0);

    const format = this.detectImageFormat(file);
    return this.canvasToBlob(canvas, format, quality);
  }

  /**
   * Carica un'immagine da un File
   * @param file File immagine da caricare
   * @returns HTMLImageElement caricato
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      // Timeout cleanup fallback per prevenire memory leak
      const timeoutId = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load timeout'));
      }, 30000); // 30 secondi timeout

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Crea un canvas HTML con le dimensioni specificate
   */
  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Converte un canvas in Blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    format: ConversionFormat,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mimeType = this.getMimeType(format);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        mimeType,
        quality / 100
      );
    });
  }

  /**
   * Calcola le dimensioni mantenendo le proporzioni
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * Rileva il formato dell'immagine dal tipo MIME
   */
  private detectImageFormat(file: File): ConversionFormat {
    if (file.type === 'image/png') return ConversionFormat.PNG;
    if (file.type === 'image/jpeg') return ConversionFormat.JPEG;
    if (file.type === 'image/webp') return ConversionFormat.WEBP;
    return ConversionFormat.PNG; // Default
  }

  /**
   * Ottieni il tipo MIME dal formato
   */
  private getMimeType(format: ConversionFormat): string {
    switch (format) {
      case ConversionFormat.PNG:
        return 'image/png';
      case ConversionFormat.JPEG:
      case ConversionFormat.JPG:
        return 'image/jpeg';
      case ConversionFormat.WEBP:
        return 'image/webp';
      default:
        return 'image/png';
    }
  }

  /**
   * Ottieni le dimensioni di un'immagine senza caricarla completamente
   */
  async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    const img = await this.loadImage(file);
    return { width: img.width, height: img.height };
  }

  /**
   * Comprimi un'immagine riducendone la qualità
   */
  async compressImage(file: File, quality: number = 70): Promise<Blob> {
    const format = this.detectImageFormat(file);
    return this.convertImage(file, format, quality);
  }

  /**
   * Converte un Data URL in Blob
   */
  dataURLtoBlob(dataURL: string): Blob {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
  }

  /**
   * Converte un Blob in Data URL
   */
  blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
