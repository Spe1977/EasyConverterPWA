import { Injectable } from '@angular/core';

/**
 * Opzioni per conversione HTML → RTF
 */
export interface HtmlToRtfOptions {
  fontSize?: number;
  fontFamily?: string;
  paperWidth?: number;
  paperHeight?: number;
}

/**
 * Service per conversioni RTF (Rich Text Format)
 * - HTML → RTF (via html-to-rtf)
 * - RTF → HTML (parsing basico)
 * - RTF → TXT (estrazione testo)
 */
@Injectable({
  providedIn: 'root',
})
export class RtfService {
  /**
   * Converte HTML in RTF
   * Browser-compatible implementation (no external dependencies)
   * Supports: paragraphs, bold, italic, underline, headings, lists
   * @param html HTML sorgente
   * @param options Opzioni di conversione
   * @returns Stringa RTF
   */
  async htmlToRtf(html: string, options: HtmlToRtfOptions = {}): Promise<string> {
    try {
      // Parse HTML usando DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Header RTF
      const rtfHeader = '{\\rtf1\\ansi\\deff0';

      // Font table (Arial e Times New Roman)
      const fontTable =
        '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\froman\\fcharset0 Times New Roman;}}';

      // Color table (black, blue, red)
      const colorTable =
        '{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red255\\green0\\blue0;}';

      // Converti il body HTML in RTF content
      const rtfContent = this.convertNodeToRtf(doc.body, options);

      // Componi documento RTF completo
      return `${rtfHeader}${fontTable}${colorTable}\n${rtfContent}\n}`;
    } catch (error) {
      throw new Error(
        `Failed to convert HTML to RTF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte un nodo DOM in RTF ricorsivamente
   * @param node Nodo DOM
   * @param options Opzioni di conversione
   * @param depth Profondità corrente della ricorsione (per prevenire stack overflow)
   * @returns Contenuto RTF
   */
  private convertNodeToRtf(node: Node, options: HtmlToRtfOptions = {}, depth: number = 0): string {
    const MAX_DEPTH = 50; // Limite massimo di nesting
    let rtf = '';

    // Previeni stack overflow con limite di profondità
    if (depth > MAX_DEPTH) {
      console.warn(
        'RTF conversion: Maximum nesting depth exceeded. Truncating deeply nested content.'
      );
      return '';
    }

    // Testo normale
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return this.escapeRtf(text);
    }

    // Elemento HTML
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      // Converti i figli con profondità incrementata
      let childContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        childContent += this.convertNodeToRtf(element.childNodes[i], options, depth + 1);
      }

      // Formattazione basata sul tag
      switch (tagName) {
        case 'p':
        case 'div':
          rtf = `${childContent}\\par\n`;
          break;

        case 'br':
          rtf = '\\line\n';
          break;

        case 'b':
        case 'strong':
          rtf = `{\\b ${childContent}}`;
          break;

        case 'i':
        case 'em':
          rtf = `{\\i ${childContent}}`;
          break;

        case 'u':
          rtf = `{\\ul ${childContent}}`;
          break;

        case 'h1':
          rtf = `{\\fs32\\b ${childContent}}\\par\n`;
          break;

        case 'h2':
          rtf = `{\\fs28\\b ${childContent}}\\par\n`;
          break;

        case 'h3':
          rtf = `{\\fs24\\b ${childContent}}\\par\n`;
          break;

        case 'h4':
        case 'h5':
        case 'h6':
          rtf = `{\\fs20\\b ${childContent}}\\par\n`;
          break;

        case 'ul':
        case 'ol':
          // Liste: ogni <li> aggiunge un bullet/numero
          rtf = `${childContent}`;
          break;

        case 'li':
          rtf = `\\bullet\\tab ${childContent}\\par\n`;
          break;

        case 'a':
          // Link: mostra solo il testo (senza href)
          rtf = `{\\ul\\cf2 ${childContent}}`;
          break;

        case 'pre':
        case 'code':
          rtf = `{\\f1 ${childContent}}\\par\n`;
          break;

        default:
          // Tag non riconosciuti: processa solo i figli
          rtf = childContent;
          break;
      }
    }

    return rtf;
  }

  /**
   * Escape caratteri speciali RTF
   * @param text Testo da escape
   * @returns Testo escaped per RTF
   */
  private escapeRtf(text: string): string {
    return text
      .replace(/\\/g, '\\\\') // Backslash
      .replace(/\{/g, '\\{') // {
      .replace(/\}/g, '\\}') // }
      .replace(/\n/g, '\\line ') // Newline
      .replace(/\t/g, '\\tab '); // Tab
  }

  /**
   * Converte RTF in HTML (parsing basico)
   * Supporta: bold, italic, underline, headings, paragrafi
   * @param rtf Contenuto RTF
   * @returns HTML
   */
  rtfToHtml(rtf: string): string {
    try {
      // Verifica che sia effettivamente RTF
      if (!rtf.trim().startsWith('{\\rtf')) {
        throw new Error('Invalid RTF format: must start with {\\rtf');
      }

      // Estrai il contenuto testuale (rimuovi comandi RTF)
      let text = this.rtfToText(rtf);

      // Converti in HTML base
      // Wrap paragrafi (separati da \par o newline)
      let html = text
        .split(/\\par\s*|\n\n+/)
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${this.escapeHtml(p.trim())}</p>`)
        .join('\n');

      // Wrap in documento HTML completo
      return this.wrapInHtml(html, 'RTF Document');
    } catch (error) {
      throw new Error(
        `Failed to convert RTF to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Estrae testo puro da RTF
   * @param rtf Contenuto RTF
   * @returns Testo puro
   */
  rtfToText(rtf: string): string {
    try {
      // Verifica formato RTF
      if (!rtf.trim().startsWith('{\\rtf')) {
        throw new Error('Invalid RTF format: must start with {\\rtf');
      }

      let text = rtf;

      // Rimuovi header RTF
      text = text.replace(/^\{\\rtf1[^}]*\}/, '');

      // Rimuovi font table
      text = text.replace(/\{\\fonttbl[^}]*\}/g, '');

      // Rimuovi color table
      text = text.replace(/\{\\colortbl[^}]*\}/g, '');

      // Rimuovi stylesheet
      text = text.replace(/\{\\stylesheet[^}]*\}/g, '');

      // Rimuovi info group
      text = text.replace(/\{\\info[^}]*\}/g, '');

      // Rimuovi comandi di formattazione comuni
      text = text.replace(/\\[a-z]+(-?\d+)?[\s]?/g, ' '); // \b, \i, \u, \fs24, etc.

      // Rimuovi gruppi nested {}
      let depth = 0;
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        } else if (depth === 0) {
          result += char;
        }
      }

      // Converti escape sequences
      result = result
        .replace(/\\'([0-9a-f]{2})/gi, (match, hex) => {
          // Converti hex in carattere (es: \'e0 → à)
          return String.fromCharCode(parseInt(hex, 16));
        })
        .replace(/\\par\s*/g, '\n\n') // Paragrafi
        .replace(/\\line\s*/g, '\n') // Line breaks
        .replace(/\\tab\s*/g, '\t') // Tabs
        .replace(/\\_/g, ' ') // Non-breaking space
        .replace(/\\-/g, '') // Optional hyphen
        .replace(/\\\\/g, '\\') // Escaped backslash
        .replace(/\\\{/g, '{') // Escaped {
        .replace(/\\\}/g, '}'); // Escaped }

      // Pulisci spazi multipli
      result = result.replace(/\s+/g, ' ').trim();

      return result;
    } catch (error) {
      throw new Error(
        `Failed to extract text from RTF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte testo puro in RTF
   * @param text Testo puro
   * @returns RTF
   */
  textToRtf(text: string): string {
    // Header RTF base
    const rtfHeader = '{\\rtf1\\ansi\\deff0';

    // Font table (Arial default)
    const fontTable = '{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}';

    // Escape caratteri speciali RTF
    const escapedText = text
      .replace(/\\/g, '\\\\') // Backslash
      .replace(/\{/g, '\\{') // {
      .replace(/\}/g, '\\}') // }
      .replace(/\n\n+/g, '\\par\\par ') // Paragrafi doppi
      .replace(/\n/g, '\\line ') // Line breaks
      .replace(/\t/g, '\\tab '); // Tabs

    // Componi documento RTF
    return `${rtfHeader}${fontTable}\n${escapedText}\n}`;
  }

  /**
   * Valida formato RTF
   * @param content Contenuto da validare
   * @returns true se è RTF valido
   */
  isValidRtf(content: string): boolean {
    const trimmed = content.trim();
    return (
      trimmed.startsWith('{\\rtf') &&
      trimmed.endsWith('}') &&
      // Check bilanciamento parentesi graffe
      this.isBalanced(trimmed)
    );
  }

  /**
   * Verifica bilanciamento parentesi graffe
   * @param text Testo da verificare
   * @returns true se bilanciato
   */
  private isBalanced(text: string): boolean {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // Skip escaped braces
      if (i > 0 && text[i - 1] === '\\') {
        continue;
      }
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth < 0) {
          return false; // Più closing che opening
        }
      }
    }
    return depth === 0;
  }

  /**
   * Escape HTML special characters
   * @param text Testo da escape
   * @returns Testo escaped
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Wrap HTML content in complete document
   * @param content HTML content
   * @param title Document title
   * @returns Complete HTML document
   */
  private wrapInHtml(content: string, title: string = 'Document'): string {
    const escapedTitle = this.escapeHtml(title);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    p { margin: 1em 0; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }
}
