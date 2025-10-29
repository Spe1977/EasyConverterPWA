/**
 * Opzioni per la scansione documenti
 */
export interface ScanOptions {
  quality?: number; // 1-100
  source?: 'camera' | 'photos'; // Sorgente immagine: camera o galleria foto
  resultType?: 'uri' | 'base64' | 'dataUrl'; // Tipo risultato
  autoDetect?: boolean; // Rilevamento automatico bordi (default: true)
  enhance?: boolean; // Auto correzione luminosità/contrasto (default: true)
  detectEdges?: boolean; // Rilevamento automatico bordi
  correctPerspective?: boolean; // Correzione prospettiva
  filter?: ScanFilter; // Filtro da applicare
  multiPage?: boolean; // Modalità multi-pagina
}

/**
 * Filtri applicabili alle scansioni
 */
export enum ScanFilter {
  NONE = 'none',
  GRAYSCALE = 'grayscale',
  BLACK_AND_WHITE = 'blackAndWhite',
  AUTO = 'auto',
}

/**
 * Risultato di una scansione
 */
export interface ScanResult {
  success: boolean; // Indica se la scansione è riuscita
  data?: string; // Base64 data o URI
  text?: string; // Testo estratto con OCR (se abilitato)
  confidence?: number; // Confidenza OCR (0-100)
  error?: string; // Messaggio di errore se success = false
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

/**
 * Punto per rilevamento bordi
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Bordi documento rilevati
 */
export interface DocumentEdges {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

/**
 * Lingue supportate per OCR
 */
export type OcrLanguage = 'ita' | 'eng' | 'fra' | 'deu' | 'spa' | 'por' | 'rus' | 'chi_sim';

/**
 * Risultato OCR
 */
export interface OcrResult {
  success: boolean;
  text?: string;
  confidence?: number; // 0-1
  error?: string;
}

/**
 * Progress OCR (0-1)
 */
export interface OcrProgress {
  progress: number; // 0-1
  status: string;
}
