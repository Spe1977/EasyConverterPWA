import { ConversionFormat } from './conversion-format';

/**
 * Risultato di una conversione
 */
export interface ConversionResult {
  blob?: Blob;
  filename?: string;
  fileName?: string; // Alias per compatibility
  format?: ConversionFormat;
  mimeType?: string;
  size?: number;
  success: boolean;
  error?: string;
  duration?: number; // milliseconds
  metadata?: {
    pages?: number;
    dimensions?: { width: number; height: number };
    encoding?: string;
    [key: string]: any;
  };
}

/**
 * Opzioni per la conversione
 */
export interface ConversionOptions {
  quality?: number; // 1-100 per immagini/PDF
  dpi?: number; // DPI per PDF to image
  scale?: number; // Scala per rendering
  pageNumbers?: number[]; // Pagine specifiche da convertire
  compression?: boolean; // Comprimi output
  [key: string]: any;
}

/**
 * Stato della conversione
 */
export interface ConversionState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: string;
}
