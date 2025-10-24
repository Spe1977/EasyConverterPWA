/**
 * Opzioni per la scansione documenti
 */
export interface ScanOptions {
  quality?: number; // 1-100
  autoEnhance?: boolean; // Auto correzione luminosità/contrasto
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
  AUTO = 'auto'
}

/**
 * Risultato di una scansione
 */
export interface ScanResult {
  image: string; // Base64 data URL
  text?: string; // Testo estratto con OCR (se abilitato)
  confidence?: number; // Confidenza OCR (0-100)
  metadata: {
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
