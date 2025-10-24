import { Injectable, OnDestroy } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Observable, Subject } from 'rxjs';
import type { ScanOptions, ScanResult } from '@core/models/scan-options';

/**
 * Scanner Service
 * Servizio per la scansione di documenti utilizzando la fotocamera del dispositivo.
 * Integra Capacitor Camera API e OpenCV.js per edge detection e perspective correction.
 */

export interface EdgeDetectionResult {
  edges: { x: number; y: number }[] | null;
  imageData: ImageData;
}

export interface ProcessingProgress {
  progress: number; // 0-100
  status: 'capturing' | 'detecting' | 'correcting' | 'enhancing' | 'completed' | 'error';
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ScannerService implements OnDestroy {
  private imageProcessingWorker: Worker | null = null;
  private progressSubject = new Subject<ProcessingProgress>();
  private isInitialized = false;

  /**
   * Observable per monitorare il progresso dell'elaborazione
   */
  public progress$: Observable<ProcessingProgress> = this.progressSubject.asObservable();

  constructor() {}

  /**
   * Inizializza il worker per l'elaborazione immagini
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Create worker
    this.imageProcessingWorker = new Worker(
      new URL('../../workers/image-processing.worker', import.meta.url),
      { type: 'module' }
    );

    // Setup message handler
    return new Promise((resolve, reject) => {
      if (!this.imageProcessingWorker) {
        reject(new Error('Failed to create image processing worker'));
        return;
      }

      this.imageProcessingWorker.onmessage = ({ data }) => {
        if (data.type === 'ready') {
          this.isInitialized = true;
          resolve();
        } else if (data.type === 'error') {
          reject(new Error(data.payload?.error || 'Worker initialization failed'));
        }
      };

      // Send init message
      this.imageProcessingWorker.postMessage({ type: 'init' });
    });
  }

  /**
   * Cattura un'immagine dalla fotocamera
   */
  public async captureImage(source: 'camera' | 'gallery' = 'camera'): Promise<Blob> {
    this.progressSubject.next({
      progress: 0,
      status: 'capturing',
      message: 'Opening camera...',
    });

    try {
      const cameraSource = source === 'camera' ? CameraSource.Camera : CameraSource.Photos;

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: cameraSource,
        quality: 100,
        allowEditing: false,
        correctOrientation: true,
      });

      if (!photo.webPath) {
        throw new Error('Failed to capture image');
      }

      // Convert to blob
      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      this.progressSubject.next({
        progress: 30,
        status: 'capturing',
        message: 'Image captured',
      });

      return blob;
    } catch (error) {
      this.progressSubject.next({
        progress: 0,
        status: 'error',
        message: `Failed to capture image: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Rileva automaticamente i bordi del documento nell'immagine
   */
  public async detectDocumentEdges(
    imageBlob: Blob,
    options: { cannyThreshold1?: number; cannyThreshold2?: number } = {}
  ): Promise<EdgeDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.progressSubject.next({
      progress: 40,
      status: 'detecting',
      message: 'Detecting document edges...',
    });

    // Convert blob to ImageData
    const imageData = await this.blobToImageData(imageBlob);

    return new Promise((resolve, reject) => {
      if (!this.imageProcessingWorker) {
        reject(new Error('Image processing worker not initialized'));
        return;
      }

      this.imageProcessingWorker.onmessage = ({ data }) => {
        if (data.type === 'result') {
          this.progressSubject.next({
            progress: 60,
            status: 'detecting',
            message: 'Edges detected',
          });
          resolve({
            edges: data.payload?.edges || null,
            imageData,
          });
        } else if (data.type === 'error') {
          this.progressSubject.next({
            progress: 0,
            status: 'error',
            message: data.payload?.error,
          });
          reject(new Error(data.payload?.error || 'Edge detection failed'));
        }
      };

      this.imageProcessingWorker.postMessage({
        type: 'detectEdges',
        payload: { imageData, options },
      });
    });
  }

  /**
   * Corregge la prospettiva del documento usando 4 punti
   */
  public async correctPerspective(
    imageBlob: Blob,
    points: { x: number; y: number }[]
  ): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (points.length !== 4) {
      throw new Error('Exactly 4 points are required for perspective correction');
    }

    this.progressSubject.next({
      progress: 70,
      status: 'correcting',
      message: 'Correcting perspective...',
    });

    // Convert blob to ImageData
    const imageData = await this.blobToImageData(imageBlob);

    return new Promise((resolve, reject) => {
      if (!this.imageProcessingWorker) {
        reject(new Error('Image processing worker not initialized'));
        return;
      }

      this.imageProcessingWorker.onmessage = async ({ data }) => {
        if (data.type === 'result' && data.payload?.imageData) {
          this.progressSubject.next({
            progress: 90,
            status: 'correcting',
            message: 'Perspective corrected',
          });

          // Convert ImageData back to Blob
          const blob = await this.imageDataToBlob(data.payload.imageData);
          resolve(blob);
        } else if (data.type === 'error') {
          this.progressSubject.next({
            progress: 0,
            status: 'error',
            message: data.payload?.error,
          });
          reject(new Error(data.payload?.error || 'Perspective correction failed'));
        }
      };

      this.imageProcessingWorker.postMessage({
        type: 'correctPerspective',
        payload: { imageData, points },
      });
    });
  }

  /**
   * Migliora l'immagine del documento (contrasto, nitidezza)
   */
  public async enhanceDocument(imageBlob: Blob): Promise<Blob> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.progressSubject.next({
      progress: 80,
      status: 'enhancing',
      message: 'Enhancing image...',
    });

    // Convert blob to ImageData
    const imageData = await this.blobToImageData(imageBlob);

    return new Promise((resolve, reject) => {
      if (!this.imageProcessingWorker) {
        reject(new Error('Image processing worker not initialized'));
        return;
      }

      this.imageProcessingWorker.onmessage = async ({ data }) => {
        if (data.type === 'result' && data.payload?.imageData) {
          this.progressSubject.next({
            progress: 95,
            status: 'enhancing',
            message: 'Image enhanced',
          });

          // Convert ImageData back to Blob
          const blob = await this.imageDataToBlob(data.payload.imageData);
          resolve(blob);
        } else if (data.type === 'error') {
          this.progressSubject.next({
            progress: 0,
            status: 'error',
            message: data.payload?.error,
          });
          reject(new Error(data.payload?.error || 'Image enhancement failed'));
        }
      };

      this.imageProcessingWorker.postMessage({
        type: 'enhance',
        payload: { imageData },
      });
    });
  }

  /**
   * Scansiona un documento con pipeline completa:
   * 1. Cattura immagine
   * 2. Rileva bordi automaticamente (opzionale)
   * 3. Correggi prospettiva
   * 4. Migliora immagine
   */
  public async scanDocument(options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Step 1: Capture image
      const imageBlob = await this.captureImage(
        options.source === 'gallery' ? 'gallery' : 'camera'
      );

      let finalBlob = imageBlob;

      // Step 2: Detect edges if auto-detect enabled
      if (options.autoDetect !== false) {
        const edgeResult = await this.detectDocumentEdges(imageBlob, {
          cannyThreshold1: 50,
          cannyThreshold2: 150,
        });

        // Step 3: Correct perspective if edges detected
        if (edgeResult.edges && edgeResult.edges.length === 4) {
          finalBlob = await this.correctPerspective(imageBlob, edgeResult.edges);
        }
      }

      // Step 4: Enhance image if enabled
      if (options.enhance !== false) {
        finalBlob = await this.enhanceDocument(finalBlob);
      }

      this.progressSubject.next({
        progress: 100,
        status: 'completed',
        message: 'Scan completed',
      });

      const duration = Date.now() - startTime;

      // Convert Blob to Base64 string
      const base64Data = await this.blobToBase64(finalBlob);

      return {
        success: true,
        data: base64Data,
      };
    } catch (error) {
      this.progressSubject.next({
        progress: 0,
        status: 'error',
        message: `Scan failed: ${error}`,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verifica se la fotocamera è disponibile su questo dispositivo
   */
  public async isCameraAvailable(): Promise<boolean> {
    if (!Capacitor.isPluginAvailable('Camera')) {
      return false;
    }

    try {
      const permissions = await Camera.checkPermissions();
      return permissions.camera === 'granted' || permissions.camera === 'prompt';
    } catch {
      return false;
    }
  }

  /**
   * Richiede i permessi per la fotocamera
   */
  public async requestCameraPermissions(): Promise<boolean> {
    try {
      const permissions = await Camera.requestPermissions();
      return permissions.camera === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Termina il worker e libera le risorse
   */
  public terminate(): void {
    if (this.imageProcessingWorker) {
      this.imageProcessingWorker.terminate();
      this.imageProcessingWorker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Converte un Blob in Base64 string
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Converte un Blob in ImageData
   */
  private async blobToImageData(blob: Blob): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        resolve(imageData);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Converte ImageData in Blob
   */
  private async imageDataToBlob(imageData: ImageData): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Cleanup quando il servizio viene distrutto
   */
  ngOnDestroy(): void {
    this.terminate();
    this.progressSubject.complete();
  }
}
