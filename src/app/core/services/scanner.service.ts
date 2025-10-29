import { Injectable, OnDestroy } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Observable, Subject } from 'rxjs';
import type { ScanOptions, ScanResult } from '@core/models/scan-options';
import { environment } from '@env/environment';
import { retryWithBackoff } from '@core/utils/retry.util';

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

export interface CameraPermissionStatus {
  granted: boolean; // True se i permessi sono concessi
  canRequest: boolean; // True se possiamo richiedere i permessi
  status: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unavailable';
  message: string; // Messaggio user-friendly
}

@Injectable({
  providedIn: 'root',
})
export class ScannerService implements OnDestroy {
  private imageProcessingWorker: Worker | null = null;
  private progressSubject = new Subject<ProcessingProgress>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Observable per monitorare il progresso dell'elaborazione
   */
  public progress$: Observable<ProcessingProgress> = this.progressSubject.asObservable();

  constructor() {}

  /**
   * Inizializza il worker per l'elaborazione immagini
   * Thread-safe: multiple concurrent calls will reuse the same initialization promise
   */
  public async initialize(): Promise<void> {
    // Return existing initialization promise if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Already initialized
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // Start new initialization and cache the promise
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } catch (error) {
      // Clear cached promise on error to allow retry
      this.initPromise = null;
      throw error;
    }

    return this.initPromise;
  }

  /**
   * Internal initialization logic with retry support
   */
  private async doInitialize(): Promise<void> {
    return retryWithBackoff(
      async () => {
        // Create worker
        this.imageProcessingWorker = new Worker(
          new URL('../../../workers/image-processing.worker.ts', import.meta.url),
          { type: 'module' }
        );

        // Setup message handler
        return new Promise<void>((resolve, reject) => {
          if (!this.imageProcessingWorker) {
            reject(new Error('Failed to create image processing worker'));
            return;
          }

          // Set timeout for initialization
          const timeout = setTimeout(() => {
            reject(new Error('Worker initialization timeout'));
          }, environment.scanner.workerTimeout);

          this.imageProcessingWorker.onmessage = ({ data }) => {
            if (data.type === 'ready') {
              clearTimeout(timeout);
              this.isInitialized = true;
              resolve();
            } else if (data.type === 'error') {
              clearTimeout(timeout);
              reject(new Error(data.payload?.error || 'Worker initialization failed'));
            }
          };

          this.imageProcessingWorker.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error(`Worker error: ${error.message || 'Unknown error'}`));
          };

          // Send init message
          this.imageProcessingWorker.postMessage({ type: 'init' });
        });
      },
      {
        ...environment.scanner.workerRetry,
        onRetry: (attempt, error) => {
          console.warn(`Scanner worker initialization retry ${attempt}: ${error.message}`);
          // Terminate failed worker before retry
          if (this.imageProcessingWorker) {
            this.imageProcessingWorker.terminate();
            this.imageProcessingWorker = null;
          }
          this.isInitialized = false;
        },
      }
    );
  }

  /**
   * Cattura un'immagine dalla fotocamera o galleria
   */
  public async captureImage(source: 'camera' | 'photos' = 'camera'): Promise<Blob> {
    this.progressSubject.next({
      progress: 0,
      status: 'capturing',
      message: 'Opening camera...',
    });

    try {
      // Check if camera is available in web environment
      if (!Capacitor.isNativePlatform() && source === 'camera') {
        // Check for getUserMedia support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Camera API not supported in this browser. Please use the photo gallery option.'
          );
        }
      }

      const cameraSource = source === 'camera' ? CameraSource.Camera : CameraSource.Photos;

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: cameraSource,
        quality: 100,
        allowEditing: false,
        correctOrientation: true,
        // Prompt for camera permission in web
        promptLabelHeader: 'Camera Permission',
        promptLabelPhoto: 'Select Photo',
        promptLabelPicture: 'Take Picture',
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
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle user cancellation gracefully
      if (errorMessage.includes('cancel') || errorMessage.includes('User cancelled')) {
        this.progressSubject.next({
          progress: 0,
          status: 'error',
          message: 'Image capture cancelled',
        });
        throw new Error('Image capture cancelled by user');
      }

      this.progressSubject.next({
        progress: 0,
        status: 'error',
        message: `Failed to capture image: ${errorMessage}`,
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
   * Valida un blob immagine prima di processarlo
   * @throws Error se la validazione fallisce
   */
  private validateImageBlob(blob: Blob): void {
    // Verifica dimensione
    if (blob.size > environment.scanner.maxImageSize) {
      const maxSizeMB = Math.round(environment.scanner.maxImageSize / (1024 * 1024));
      const actualSizeMB = Math.round(blob.size / (1024 * 1024));
      throw new Error(
        `Image too large: ${actualSizeMB}MB (max ${maxSizeMB}MB). Please use a smaller image.`
      );
    }

    // Verifica formato
    const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!supportedFormats.includes(blob.type)) {
      throw new Error(
        `Unsupported image format: ${blob.type}. Supported formats: JPEG, PNG, WEBP.`
      );
    }
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
      const imageBlob = await this.captureImage(options.source === 'photos' ? 'photos' : 'camera');

      // Validate image before processing
      this.validateImageBlob(imageBlob);

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
   * @deprecated Use checkCameraPermissionStatus() for more detailed information
   */
  public async isCameraAvailable(): Promise<boolean> {
    const status = await this.checkCameraPermissionStatus();
    return status.granted || status.canRequest;
  }

  /**
   * Controlla lo stato dettagliato dei permessi camera
   * Fornisce informazioni su permessi, disponibilità e messaggi user-friendly
   */
  public async checkCameraPermissionStatus(): Promise<CameraPermissionStatus> {
    // Check if Camera plugin is available
    if (!Capacitor.isPluginAvailable('Camera')) {
      return {
        granted: false,
        canRequest: false,
        status: 'unavailable',
        message: 'Camera is not available on this device',
      };
    }

    try {
      const permissions = await Camera.checkPermissions();
      const cameraStatus = permissions.camera;

      switch (cameraStatus) {
        case 'granted':
          return {
            granted: true,
            canRequest: false,
            status: 'granted',
            message: 'Camera access granted',
          };

        case 'denied':
          return {
            granted: false,
            canRequest: false,
            status: 'denied',
            message:
              'Camera access denied. Please enable camera permissions in your device settings.',
          };

        case 'prompt':
        case 'prompt-with-rationale':
          return {
            granted: false,
            canRequest: true,
            status: cameraStatus,
            message: 'Camera permission not yet requested',
          };

        case 'limited':
          return {
            granted: true, // Limited access is still usable
            canRequest: false,
            status: 'limited',
            message: 'Camera access is limited',
          };

        default:
          return {
            granted: false,
            canRequest: false,
            status: 'unavailable',
            message: `Unknown permission status: ${cameraStatus}`,
          };
      }
    } catch (error) {
      console.error('Error checking camera permissions:', error);
      return {
        granted: false,
        canRequest: false,
        status: 'unavailable',
        message: 'Failed to check camera permissions',
      };
    }
  }

  /**
   * Richiede i permessi per la fotocamera
   * @returns CameraPermissionStatus con il risultato della richiesta
   */
  public async requestCameraPermissions(): Promise<CameraPermissionStatus> {
    try {
      const permissions = await Camera.requestPermissions();
      const cameraStatus = permissions.camera;

      if (cameraStatus === 'granted' || cameraStatus === 'limited') {
        return {
          granted: true,
          canRequest: false,
          status: cameraStatus,
          message: 'Camera permission granted',
        };
      } else if (cameraStatus === 'denied') {
        return {
          granted: false,
          canRequest: false,
          status: 'denied',
          message:
            'Camera permission denied. Please enable it in your device settings to use this feature.',
        };
      } else {
        return {
          granted: false,
          canRequest: true,
          status: cameraStatus,
          message: 'Camera permission not granted',
        };
      }
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return {
        granted: false,
        canRequest: false,
        status: 'unavailable',
        message: 'Failed to request camera permissions',
      };
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
