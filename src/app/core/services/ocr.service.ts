import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { OcrResult, OcrProgress } from '@core/models/scan-options';
import { environment } from '@env/environment';
import { retryWithBackoff } from '@core/utils/retry.util';

/**
 * OCR Service
 * Servizio per il riconoscimento ottico dei caratteri (OCR) utilizzando Tesseract.js.
 * Le operazioni OCR vengono eseguite in un Web Worker per non bloccare il main thread.
 */

export interface OcrOptions {
  language?: string;
  languages?: string[]; // For multi-language OCR
}

@Injectable({
  providedIn: 'root',
})
export class OcrService implements OnDestroy {
  private worker: Worker | null = null;
  private progressSubject = new Subject<OcrProgress>();
  private isInitialized = false;
  private currentLanguages: string[] = ['ita'];

  /**
   * Observable per monitorare il progresso dell'OCR
   */
  public progress$: Observable<OcrProgress> = this.progressSubject.asObservable();

  constructor() {}

  /**
   * Inizializza il worker OCR con le lingue specificate
   * Include retry logic con exponential backoff
   */
  public async initialize(languages: string[] = ['ita']): Promise<void> {
    if (this.isInitialized && this.arraysEqual(this.currentLanguages, languages)) {
      return; // Already initialized with same languages
    }

    this.currentLanguages = languages;

    return retryWithBackoff(
      async () => {
        // Create worker
        this.worker = new Worker(new URL('../../../workers/ocr.worker.ts', import.meta.url), {
          type: 'module',
        });

        // Setup message handler
        return new Promise<void>((resolve, reject) => {
          if (!this.worker) {
            reject(new Error('Failed to create OCR worker'));
            return;
          }

          // Set timeout for initialization
          const timeout = setTimeout(() => {
            reject(new Error('OCR worker initialization timeout'));
          }, environment.scanner.workerTimeout);

          this.worker.onmessage = ({ data }) => {
            switch (data.type) {
              case 'ready':
                clearTimeout(timeout);
                this.isInitialized = true;
                this.progressSubject.next({
                  progress: 0,
                  status: 'initializing',
                });
                resolve();
                break;

              case 'error':
                clearTimeout(timeout);
                this.progressSubject.next({
                  progress: 0,
                  status: 'error',
                });
                reject(new Error(data.payload?.error || 'OCR initialization failed'));
                break;
            }
          };

          this.worker.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error(`OCR worker error: ${error.message || 'Unknown error'}`));
          };

          // Send init message
          this.worker.postMessage({
            type: 'init',
            payload: { languages },
          });
        });
      },
      {
        ...environment.scanner.workerRetry,
        onRetry: (attempt, error) => {
          console.warn(`OCR worker initialization retry ${attempt}: ${error.message}`);
          // Terminate failed worker before retry
          if (this.worker) {
            this.worker.terminate();
            this.worker = null;
          }
          this.isInitialized = false;
        },
      }
    );
  }

  /**
   * Esegue il riconoscimento OCR su un'immagine
   * @param imageSource - Può essere un Blob, File, base64 string, o URL
   * @param options - Opzioni OCR (lingua, etc.)
   */
  public async recognizeText(
    imageSource: Blob | File | string,
    options: OcrOptions = {}
  ): Promise<OcrResult> {
    // Initialize if not already done
    const languages = options.languages || (options.language ? [options.language] : ['ita']);
    if (!this.isInitialized) {
      await this.initialize(languages);
    }

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    // Convert image source to base64 if needed
    let imageData: string;
    if (typeof imageSource === 'string') {
      imageData = imageSource;
    } else {
      imageData = await this.blobToBase64(imageSource);
    }

    // Execute OCR
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('OCR worker not available'));
        return;
      }

      this.worker.onmessage = ({ data }) => {
        switch (data.type) {
          case 'progress':
            this.progressSubject.next({
              progress: data.payload?.progress || 0,
              status: 'recognizing',
            });
            break;

          case 'result':
            this.progressSubject.next({
              progress: 1,
              status: 'OCR completed',
            });
            resolve({
              success: true,
              text: data.payload?.text || '',
              confidence: data.payload?.confidence || 0,
            });
            break;

          case 'error':
            this.progressSubject.next({
              progress: 0,
              status: 'OCR error',
            });
            resolve({
              success: false,
              error: data.payload?.error || 'OCR recognition failed',
            });
            break;
        }
      };

      // Send recognize message
      this.worker.postMessage({
        type: 'recognize',
        payload: {
          imageData,
          language: options.language || this.currentLanguages.join('+'),
        },
      });
    });
  }

  /**
   * Esegue OCR su più immagini in sequenza
   */
  public async recognizeMultiple(
    images: (Blob | File | string)[],
    options: OcrOptions = {}
  ): Promise<OcrResult[]> {
    const results: OcrResult[] = [];

    for (const image of images) {
      const result = await this.recognizeText(image, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Verifica se una lingua è supportata
   */
  public isSupportedLanguage(language: string): boolean {
    const supportedLanguages = ['ita', 'eng', 'fra', 'deu', 'spa', 'por', 'rus', 'chi_sim'];
    return supportedLanguages.includes(language);
  }

  /**
   * Ottiene la lista delle lingue supportate
   */
  public getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'ita', name: 'Italian' },
      { code: 'eng', name: 'English' },
      { code: 'fra', name: 'French' },
      { code: 'deu', name: 'German' },
      { code: 'spa', name: 'Spanish' },
      { code: 'por', name: 'Portuguese' },
      { code: 'rus', name: 'Russian' },
      { code: 'chi_sim', name: 'Chinese Simplified' },
    ];
  }

  /**
   * Termina il worker e libera le risorse
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Converte un Blob in base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Utility per confrontare due array
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * Cleanup quando il servizio viene distrutto
   */
  ngOnDestroy(): void {
    this.terminate();
    this.progressSubject.complete();
  }
}
