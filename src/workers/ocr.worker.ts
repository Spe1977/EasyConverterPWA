/// <reference lib="webworker" />

/**
 * OCR Web Worker
 * Esegue il riconoscimento ottico dei caratteri (OCR) in background
 * utilizzando Tesseract.js per evitare di bloccare il main thread.
 */

import type { createWorker, Worker as TesseractWorker } from 'tesseract.js';

interface OcrMessage {
  type: 'init' | 'recognize' | 'terminate';
  payload?: {
    imageData?: string; // Base64 or URL
    language?: string;
    languages?: string[];
  };
}

interface OcrResponse {
  type: 'ready' | 'progress' | 'result' | 'error';
  payload?: {
    progress?: number;
    text?: string;
    confidence?: number;
    error?: string;
  };
}

let tesseractWorker: TesseractWorker | null = null;

/**
 * Inizializza il worker Tesseract.js con la lingua specificata
 */
async function initializeWorker(languages: string[] = ['ita']): Promise<void> {
  try {
    // Lazy load tesseract.js
    const Tesseract = await import('tesseract.js');
    const createWorkerFn: typeof createWorker = Tesseract.createWorker;

    // Configure Tesseract.js with CDN paths for traineddata files
    // Using jsDelivr CDN for reliable access to Tesseract language data
    tesseractWorker = await createWorkerFn(languages.join('+'), 1, {
      langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/lang-data',
      logger: (m: any) => {
        // Report progress during OCR recognition
        if (m.status === 'recognizing text') {
          self.postMessage({
            type: 'progress',
            payload: { progress: Math.round(m.progress * 100) },
          } as OcrResponse);
        }
      },
    });

    self.postMessage({ type: 'ready' } as OcrResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { error: `Failed to initialize OCR worker: ${error}` },
    } as OcrResponse);
  }
}

/**
 * Esegue il riconoscimento OCR sull'immagine fornita
 */
async function recognizeText(imageData: string, language?: string): Promise<void> {
  if (!tesseractWorker) {
    self.postMessage({
      type: 'error',
      payload: { error: 'OCR worker not initialized' },
    } as OcrResponse);
    return;
  }

  try {
    // Set language if different from current
    if (language) {
      await tesseractWorker.reinitialize(language);
    }

    // Perform OCR
    const result = await tesseractWorker.recognize(imageData);

    self.postMessage({
      type: 'result',
      payload: {
        text: result.data.text,
        confidence: result.data.confidence,
      },
    } as OcrResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { error: `OCR recognition failed: ${error}` },
    } as OcrResponse);
  }
}

/**
 * Termina il worker e libera le risorse
 */
async function terminateWorker(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
  self.postMessage({ type: 'ready' } as OcrResponse);
}

// Message handler
self.addEventListener('message', async ({ data }: MessageEvent<OcrMessage>) => {
  switch (data.type) {
    case 'init':
      await initializeWorker(data.payload?.languages);
      break;

    case 'recognize':
      if (data.payload?.imageData) {
        await recognizeText(data.payload.imageData, data.payload.language);
      }
      break;

    case 'terminate':
      await terminateWorker();
      break;

    default:
      self.postMessage({
        type: 'error',
        payload: { error: `Unknown message type: ${data.type}` },
      } as OcrResponse);
  }
});
