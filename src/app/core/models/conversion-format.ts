/**
 * Formati di file supportati per le conversioni
 */
export enum ConversionFormat {
  // Documenti di testo
  TXT = 'txt',
  MD = 'md',
  HTML = 'html',

  // Fogli di calcolo e dati
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  ODS = 'ods',

  // PDF
  PDF = 'pdf',

  // Immagini
  PNG = 'png',
  JPEG = 'jpeg',
  JPG = 'jpg',
  WEBP = 'webp',

  // E-book
  EPUB = 'epub'
}

/**
 * Mappa dei formati con metadati
 */
export interface FormatInfo {
  format: ConversionFormat;
  label: string;
  mimeType: string;
  extensions: string[];
  category: 'document' | 'spreadsheet' | 'pdf' | 'image' | 'ebook';
  icon: string;
}

/**
 * Configurazione formati supportati
 */
export const SUPPORTED_FORMATS: FormatInfo[] = [
  // Documenti
  { format: ConversionFormat.TXT, label: 'Testo', mimeType: 'text/plain', extensions: ['.txt'], category: 'document', icon: 'document-text' },
  { format: ConversionFormat.MD, label: 'Markdown', mimeType: 'text/markdown', extensions: ['.md'], category: 'document', icon: 'logo-markdown' },
  { format: ConversionFormat.HTML, label: 'HTML', mimeType: 'text/html', extensions: ['.html', '.htm'], category: 'document', icon: 'code' },

  // Fogli di calcolo
  { format: ConversionFormat.CSV, label: 'CSV', mimeType: 'text/csv', extensions: ['.csv'], category: 'spreadsheet', icon: 'grid' },
  { format: ConversionFormat.JSON, label: 'JSON', mimeType: 'application/json', extensions: ['.json'], category: 'spreadsheet', icon: 'code-slash' },
  { format: ConversionFormat.XLSX, label: 'Excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['.xlsx'], category: 'spreadsheet', icon: 'stats-chart' },
  { format: ConversionFormat.ODS, label: 'OpenDocument', mimeType: 'application/vnd.oasis.opendocument.spreadsheet', extensions: ['.ods'], category: 'spreadsheet', icon: 'document' },

  // PDF
  { format: ConversionFormat.PDF, label: 'PDF', mimeType: 'application/pdf', extensions: ['.pdf'], category: 'pdf', icon: 'document-attach' },

  // Immagini
  { format: ConversionFormat.PNG, label: 'PNG', mimeType: 'image/png', extensions: ['.png'], category: 'image', icon: 'image' },
  { format: ConversionFormat.JPEG, label: 'JPEG', mimeType: 'image/jpeg', extensions: ['.jpg', '.jpeg'], category: 'image', icon: 'image' },
  { format: ConversionFormat.WEBP, label: 'WebP', mimeType: 'image/webp', extensions: ['.webp'], category: 'image', icon: 'image' },

  // E-book
  { format: ConversionFormat.EPUB, label: 'EPUB', mimeType: 'application/epub+zip', extensions: ['.epub'], category: 'ebook', icon: 'book' }
];
