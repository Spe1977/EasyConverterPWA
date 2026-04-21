import { Injectable } from '@angular/core';

/**
 * Opzioni per encoding Base64
 */
export interface Base64EncodeOptions {
  /**
   * Includi data URI prefix (es: data:image/png;base64,)
   */
  includeDataUri?: boolean;
  /**
   * MIME type per data URI (auto-detect se non specificato)
   */
  mimeType?: string;
}

/**
 * Opzioni per decoding Base64
 */
export interface Base64DecodeOptions {
  /**
   * Output come Blob invece di ArrayBuffer
   */
  asBlob?: boolean;
  /**
   * MIME type per Blob output (rilevato da data URI se presente)
   */
  mimeType?: string;
}

/**
 * Risultato decode Base64
 */
export interface Base64DecodeResult {
  /**
   * Dati binari (ArrayBuffer o Blob)
   */
  data: ArrayBuffer | Blob;
  /**
   * MIME type rilevato (se presente nel data URI)
   */
  mimeType?: string;
  /**
   * Dimensione in bytes
   */
  size: number;
}

/**
 * Service per conversioni Base64
 * - File → Base64 (con/senza data URI)
 * - Base64 → File (con auto-detection MIME type)
 * - Testo → Base64
 * - Base64 → Testo
 *
 * 100% nativo JavaScript (0KB bundle size)
 */
@Injectable({
  providedIn: 'root',
})
export class Base64Service {
  /**
   * Converte File/Blob in Base64
   * @param file File o Blob da encodare
   * @param options Opzioni di encoding
   * @returns Stringa Base64 (opzionalmente con data URI prefix)
   */
  async fileToBase64(file: File | Blob, options: Base64EncodeOptions = {}): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = this.arrayBufferToBase64(arrayBuffer);

      if (options.includeDataUri) {
        const mimeType =
          options.mimeType || (file instanceof File ? file.type : 'application/octet-stream');
        return `data:${mimeType};base64,${base64}`;
      }

      return base64;
    } catch (error) {
      throw new Error(
        `Failed to encode file to Base64: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte Base64 in File/Blob
   * @param base64 Stringa Base64 (con o senza data URI prefix)
   * @param options Opzioni di decoding
   * @returns Risultato con dati e metadata
   */
  async base64ToFile(
    base64: string,
    options: Base64DecodeOptions = {}
  ): Promise<Base64DecodeResult> {
    try {
      // Rimuovi whitespace
      let cleanBase64 = base64.replace(/\s/g, '');
      let mimeType = options.mimeType;

      // Detect e rimuovi data URI prefix. Il MIME type deve rispettare il
      // formato RFC 6838 (tipo/sottotipo); ciò blocca payload tipo
      // "data:javascript:;base64,..." prima che finiscano nel Blob.
      const dataUriMatch = cleanBase64.match(/^data:([a-z]+\/[a-z0-9\-+.]+);base64,(.+)$/i);
      if (dataUriMatch) {
        mimeType = mimeType || dataUriMatch[1];
        cleanBase64 = dataUriMatch[2];
      } else if (/^data:/i.test(cleanBase64)) {
        throw new Error('Invalid data URI format');
      }

      // Decode Base64 to ArrayBuffer
      const arrayBuffer = this.base64ToArrayBuffer(cleanBase64);

      // Return come Blob o ArrayBuffer
      if (options.asBlob) {
        const blob = new Blob([arrayBuffer], { type: mimeType || 'application/octet-stream' });
        return {
          data: blob,
          mimeType,
          size: blob.size,
        };
      }

      return {
        data: arrayBuffer,
        mimeType,
        size: arrayBuffer.byteLength,
      };
    } catch (error) {
      throw new Error(
        `Failed to decode Base64 to file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte testo in Base64
   * @param text Testo da encodare
   * @param encoding Encoding del testo (default: UTF-8)
   * @returns Stringa Base64
   */
  textToBase64(text: string, encoding: 'utf-8' | 'utf-16' = 'utf-8'): string {
    try {
      if (encoding === 'utf-8') {
        // Usa TextEncoder nativo (UTF-8)
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(text);
        return this.uint8ArrayToBase64(uint8Array);
      } else {
        // UTF-16: usa btoa con encoding manual
        return btoa(unescape(encodeURIComponent(text)));
      }
    } catch (error) {
      throw new Error(
        `Failed to encode text to Base64: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte Base64 in testo
   * @param base64 Stringa Base64
   * @param encoding Encoding del testo (default: UTF-8)
   * @returns Testo decodificato
   */
  base64ToText(base64: string, encoding: 'utf-8' | 'utf-16' = 'utf-8'): string {
    try {
      // Rimuovi whitespace
      const cleanBase64 = base64.replace(/\s/g, '');

      // Rimuovi data URI prefix se presente
      const dataUriMatch = cleanBase64.match(/^data:[^;]+;base64,(.+)$/);
      const pureBase64 = dataUriMatch ? dataUriMatch[1] : cleanBase64;

      if (encoding === 'utf-8') {
        // Usa TextDecoder nativo (UTF-8)
        const arrayBuffer = this.base64ToArrayBuffer(pureBase64);
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(arrayBuffer);
      } else {
        // UTF-16: usa atob
        return decodeURIComponent(escape(atob(pureBase64)));
      }
    } catch (error) {
      throw new Error(
        `Failed to decode Base64 to text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Valida stringa Base64
   * @param base64 Stringa da validare
   * @returns true se valida
   */
  isValidBase64(base64: string): boolean {
    try {
      // Rimuovi whitespace e data URI prefix
      let clean = base64.replace(/\s/g, '');
      const dataUriMatch = clean.match(/^data:[^;]+;base64,(.+)$/);
      if (dataUriMatch) {
        clean = dataUriMatch[1];
      }

      // Check formato Base64 (A-Z, a-z, 0-9, +, /, =)
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
        return false;
      }

      // Check lunghezza (deve essere multiplo di 4)
      if (clean.length % 4 !== 0) {
        return false;
      }

      // Try decode
      atob(clean);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estrai MIME type da data URI
   * @param dataUri Data URI Base64
   * @returns MIME type o null
   */
  extractMimeType(dataUri: string): string | null {
    const match = dataUri.match(/^data:([^;]+);base64,/);
    return match ? match[1] : null;
  }

  /**
   * Calcola dimensione decodificata (in bytes) senza decodificare
   * @param base64 Stringa Base64
   * @returns Dimensione stimata in bytes
   */
  estimateDecodedSize(base64: string): number {
    // Rimuovi data URI prefix e whitespace
    let clean = base64.replace(/\s/g, '');
    const dataUriMatch = clean.match(/^data:[^;]+;base64,(.+)$/);
    if (dataUriMatch) {
      clean = dataUriMatch[1];
    }

    // Conta padding
    const padding = (clean.match(/=/g) || []).length;

    // Formula: (lunghezza * 3/4) - padding
    return (clean.length * 3) / 4 - padding;
  }

  /**
   * Converte ArrayBuffer in Base64
   * @param buffer ArrayBuffer
   * @returns Stringa Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    return this.uint8ArrayToBase64(uint8Array);
  }

  /**
   * Converte Uint8Array in Base64
   * @param uint8Array Uint8Array
   * @returns Stringa Base64
   */
  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    // Metodo ottimizzato per grandi file
    const CHUNK_SIZE = 0x8000; // 32KB chunks
    const chunks: string[] = [];

    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
      chunks.push(String.fromCharCode(...chunk));
    }

    return btoa(chunks.join(''));
  }

  /**
   * Converte Base64 in ArrayBuffer
   * @param base64 Stringa Base64
   * @returns ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return bytes.buffer;
    } catch (error) {
      throw new Error(
        `Invalid Base64 string: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converti Base64 in Data URL (aggiunge prefix se mancante)
   * @param base64 Stringa Base64
   * @param mimeType MIME type (default: application/octet-stream)
   * @returns Data URL
   */
  toDataUrl(base64: string, mimeType: string = 'application/octet-stream'): string {
    // Se è già data URL, ritorna così
    if (base64.startsWith('data:')) {
      return base64;
    }

    return `data:${mimeType};base64,${base64}`;
  }

  /**
   * Rimuovi data URI prefix da Base64
   * @param dataUri Data URI o Base64
   * @returns Base64 puro
   */
  stripDataUri(dataUri: string): string {
    const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : dataUri;
  }
}
