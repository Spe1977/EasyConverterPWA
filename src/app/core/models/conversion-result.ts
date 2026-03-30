import { ConversionFormat } from './conversion-format';

export type StructuredDataPrimitiveArrayStrategy = 'join' | 'json';
export type StructuredDataColumnNamingStrategy = 'dot' | 'snake_case';

export class ConversionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Conversion timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    this.name = 'ConversionTimeoutError';
  }
}

export class ConversionCancelledError extends Error {
  constructor() {
    super('Conversion cancelled');
    this.name = 'ConversionCancelledError';
  }
}

export interface StructuredDataExportOptions {
  collectionPath?: string | null;
  primitiveArrayStrategy?: StructuredDataPrimitiveArrayStrategy;
  columnNaming?: StructuredDataColumnNamingStrategy;
}

export interface StructuredDataExportProfile {
  collectionPaths: string[];
  defaultOptions: Required<StructuredDataExportOptions>;
}

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
  // HTML options
  htmlSanitize?: boolean; // Sanitize HTML (XSS protection)
  htmlInlineCss?: boolean; // Inline CSS for emails
  htmlMinify?: boolean; // Minify HTML output
  // Image options
  preserveExif?: boolean; // Preserve EXIF metadata in images
  signal?: AbortSignal;
  structuredData?: StructuredDataExportOptions;
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
