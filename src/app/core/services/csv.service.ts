import { Injectable } from '@angular/core';
import * as Papa from 'papaparse';

/**
 * Opzioni per parsing CSV
 */
export interface CsvParseOptions {
  delimiter?: string; // Auto-detect se non specificato
  encoding?: string; // Auto-detect se non specificato
  header?: boolean;
  skipEmptyLines?: boolean;
  dynamicTyping?: boolean;
}

/**
 * Risultato parsing CSV
 */
export interface CsvParseResult {
  data: Record<string, unknown>[];
  meta: {
    delimiter: string;
    linebreak: string;
    fields?: string[];
  };
  errors: Array<{
    type: string;
    code: string;
    message: string;
    row?: number;
  }>;
}

/**
 * Service per gestire operazioni CSV avanzate
 * Usa papaparse con auto-detection di encoding e delimiter
 */
@Injectable({
  providedIn: 'root',
})
export class CsvService {
  /**
   * Parse CSV con auto-detection di delimiter e encoding
   * @param file File CSV
   * @param options Opzioni di parsing
   * @returns Dati parsed e metadata
   */
  async parseCsv(file: File, options: CsvParseOptions = {}): Promise<CsvParseResult> {
    const text = await this.readFileAsText(file, options.encoding);

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        delimiter: options.delimiter, // Se undefined, papaparse auto-detect
        header: options.header ?? false,
        skipEmptyLines: options.skipEmptyLines ?? true,
        dynamicTyping: options.dynamicTyping ?? true,
        delimitersToGuess: [',', ';', '\t', '|', Papa.RECORD_SEP, Papa.UNIT_SEP],
        complete: (results) => {
          resolve({
            data: results.data as Record<string, unknown>[],
            meta: results.meta as CsvParseResult['meta'],
            errors: results.errors,
          });
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  }

  /**
   * Converte dati in CSV con opzioni avanzate
   * @param data Array di oggetti o array 2D
   * @param options Opzioni di conversione
   * @returns Stringa CSV
   */
  stringifyCsv(
    data: Record<string, unknown>[],
    options: {
      delimiter?: string;
      header?: boolean;
      quotes?: boolean | boolean[];
      quoteChar?: string;
      escapeChar?: string;
      newline?: string;
    } = {}
  ): string {
    return Papa.unparse(data, {
      delimiter: options.delimiter || ',',
      header: options.header ?? true,
      quotes: options.quotes ?? false,
      quoteChar: options.quoteChar || '"',
      escapeChar: options.escapeChar || '"',
      newline: options.newline || '\r\n',
    });
  }

  /**
   * Rileva automaticamente il delimiter di un CSV
   * @param text Testo CSV
   * @returns Delimiter rilevato
   */
  detectDelimiter(text: string): string {
    // Usa papaparse per rilevare il delimiter
    const sample = text.split('\n').slice(0, 5).join('\n'); // Usa prime 5 righe
    const result = Papa.parse(sample, {
      preview: 5,
      delimitersToGuess: [',', ';', '\t', '|'],
    });

    return result.meta.delimiter;
  }

  /**
   * Rileva encoding del file (euristica semplice)
   * @param file File da analizzare
   * @returns Encoding rilevato
   */
  async detectEncoding(file: File): Promise<string> {
    // Leggi i primi byte per rilevare BOM o caratteri speciali
    const buffer = await file.slice(0, Math.min(1024, file.size)).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for UTF-8 BOM
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return 'UTF-8';
    }

    // Check for UTF-16 LE BOM
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return 'UTF-16LE';
    }

    // Check for UTF-16 BE BOM
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return 'UTF-16BE';
    }

    // Try to detect UTF-8 vs Latin-1/Windows-1252
    // UTF-8 ha sequenze multi-byte specifiche
    let hasHighBytes = false;
    let isValidUtf8 = true;

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];

      if (byte > 0x7f) {
        hasHighBytes = true;

        // Verifica sequenza UTF-8 valida
        if ((byte & 0xe0) === 0xc0) {
          // 2-byte sequence
          if (i + 1 >= bytes.length || (bytes[i + 1] & 0xc0) !== 0x80) {
            isValidUtf8 = false;
            break;
          }
          i += 1;
        } else if ((byte & 0xf0) === 0xe0) {
          // 3-byte sequence
          if (
            i + 2 >= bytes.length ||
            (bytes[i + 1] & 0xc0) !== 0x80 ||
            (bytes[i + 2] & 0xc0) !== 0x80
          ) {
            isValidUtf8 = false;
            break;
          }
          i += 2;
        } else if ((byte & 0xf8) === 0xf0) {
          // 4-byte sequence
          if (
            i + 3 >= bytes.length ||
            (bytes[i + 1] & 0xc0) !== 0x80 ||
            (bytes[i + 2] & 0xc0) !== 0x80 ||
            (bytes[i + 3] & 0xc0) !== 0x80
          ) {
            isValidUtf8 = false;
            break;
          }
          i += 3;
        } else {
          // Invalid UTF-8 sequence
          isValidUtf8 = false;
          break;
        }
      }
    }

    // Se non ci sono byte alti, è puro ASCII (compatibile con UTF-8)
    if (!hasHighBytes) {
      return 'UTF-8';
    }

    // Se è UTF-8 valido, usa UTF-8
    if (isValidUtf8) {
      return 'UTF-8';
    }

    // Altrimenti, probabilmente è Windows-1252 o ISO-8859-1
    // Windows-1252 è più comune e compatibile con ISO-8859-1 per la maggior parte
    return 'Windows-1252';
  }

  /**
   * Valida CSV e restituisce errori
   * @param file File CSV
   * @returns Lista di errori (vuota se valido)
   */
  async validateCsv(file: File): Promise<
    Array<{
      type: string;
      code: string;
      message: string;
      row?: number;
    }>
  > {
    const result = await this.parseCsv(file);
    return result.errors;
  }

  /**
   * Legge file come testo con encoding specificato
   * Refactored to avoid multiple FileReader instances
   */
  private async readFileAsText(file: File, encoding?: string): Promise<string> {
    // Auto-detect encoding if not specified
    const finalEncoding = encoding || (await this.detectEncoding(file));

    // Create single FileReader instance
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsText(file, finalEncoding);
    });
  }

  /**
   * Quote handling avanzato: escape di caratteri speciali
   * @param value Valore da quotare
   * @param forceQuote Se true, quota sempre
   * @returns Valore quotato e escaped
   */
  quoteValue(value: string, forceQuote: boolean = false): string {
    const needsQuoting =
      forceQuote ||
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r');

    if (!needsQuoting) {
      return value;
    }

    // Escape double quotes con doppio double quote
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Unquote un valore CSV
   * @param value Valore quotato
   * @returns Valore senza quote
   */
  unquoteValue(value: string): string {
    if (value.startsWith('"') && value.endsWith('"')) {
      // Rimuovi quote esterne e unescape double quotes
      return value.slice(1, -1).replace(/""/g, '"');
    }
    return value;
  }

  /**
   * Converte CSV in JSON con header detection
   * @param file File CSV
   * @returns Array di oggetti JSON
   */
  async csvToJson(file: File): Promise<Record<string, unknown>[]> {
    const result = await this.parseCsv(file, { header: true, dynamicTyping: true });
    return result.data;
  }

  /**
   * Converte JSON in CSV
   * @param data Array di oggetti JSON
   * @param delimiter Delimiter da usare
   * @returns Stringa CSV
   */
  jsonToCsv(data: Record<string, unknown>[], delimiter: string = ','): string {
    return this.stringifyCsv(data, { delimiter, header: true });
  }
}
