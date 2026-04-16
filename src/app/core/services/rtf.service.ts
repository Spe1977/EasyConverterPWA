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
 * Token prodotto dal tokenizer RTF
 */
interface RtfToken {
  type: 'group-open' | 'group-close' | 'control' | 'text' | 'unicode';
  word?: string;
  param?: number;
  value?: string;
}

/**
 * Stato di formattazione corrente nel parser RTF
 */
interface RtfParserState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  superscript: boolean;
  subscript: boolean;
  fontSize: number;
  unicodeSkipCount: number;
  inList: boolean;
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
   * Converte RTF in HTML con preservazione della formattazione.
   * Supporta: bold, italic, underline, font size, paragrafi, line break,
   * liste (bullet), link text, code blocks, headings (via font size).
   * @param rtf Contenuto RTF
   * @returns HTML
   */
  rtfToHtml(rtf: string): string {
    try {
      if (!rtf.trim().startsWith('{\\rtf')) {
        throw new Error('Invalid RTF format: must start with {\\rtf');
      }

      const tokens = this.tokenizeRtf(rtf);
      const bodyHtml = this.tokensToHtml(tokens);

      return this.wrapInHtml(bodyHtml, 'RTF Document');
    } catch (error) {
      throw new Error(
        `Failed to convert RTF to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stato di formattazione corrente nel parser RTF
   */
  private createDefaultState(): RtfParserState {
    return {
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      superscript: false,
      subscript: false,
      fontSize: 0,
      unicodeSkipCount: 1,
      inList: false,
    };
  }

  /**
   * Tokenizza una stringa RTF in token strutturati.
   * Gestisce gruppi {}, control words, escape hex e testo.
   */
  private tokenizeRtf(rtf: string): RtfToken[] {
    const tokens: RtfToken[] = [];
    let i = 0;
    const len = rtf.length;

    while (i < len) {
      const ch = rtf[i];

      if (ch === '{') {
        tokens.push({ type: 'group-open' });
        i++;
      } else if (ch === '}') {
        tokens.push({ type: 'group-close' });
        i++;
      } else if (ch === '\\') {
        i++;
        if (i >= len) break;

        // Escaped literal characters
        if (rtf[i] === '\\' || rtf[i] === '{' || rtf[i] === '}') {
          tokens.push({ type: 'text', value: rtf[i] });
          i++;
        } else if (rtf[i] === "'") {
          // Hex escape: \'XX
          i++;
          if (i + 1 < len) {
            const hex = rtf.substring(i, i + 2);
            tokens.push({ type: 'text', value: String.fromCharCode(parseInt(hex, 16)) });
            i += 2;
          }
        } else if (rtf[i] === '~') {
          tokens.push({ type: 'text', value: '\u00A0' }); // non-breaking space
          i++;
        } else if (rtf[i] === '-') {
          i++; // optional hyphen — skip
        } else if (rtf[i] === '_') {
          tokens.push({ type: 'text', value: '\u00A0' }); // non-breaking hyphen as space
          i++;
        } else {
          // Control word: \keyword[-]N? followed by optional space delimiter
          let word = '';
          while (i < len && /[a-zA-Z]/.test(rtf[i])) {
            word += rtf[i];
            i++;
          }
          let param: number | undefined;
          if (i < len && (rtf[i] === '-' || /[0-9]/.test(rtf[i]))) {
            let numStr = '';
            if (rtf[i] === '-') {
              numStr += '-';
              i++;
            }
            while (i < len && /[0-9]/.test(rtf[i])) {
              numStr += rtf[i];
              i++;
            }
            param = parseInt(numStr, 10);
          }
          // Space delimiter after control word is consumed (not part of text)
          if (i < len && rtf[i] === ' ') {
            i++;
          }
          if (word === 'u' && param !== undefined) {
            // \uN is a Unicode character — emit as unicode token
            // Negative values are unsigned: \u-4 means 65532
            const codePoint = param < 0 ? param + 65536 : param;
            tokens.push({ type: 'unicode', value: String.fromCodePoint(codePoint), param });
          } else if (word) {
            tokens.push({ type: 'control', word, param });
          }
        }
      } else if (ch === '\r' || ch === '\n') {
        i++; // Skip raw newlines in RTF source (not meaningful)
      } else {
        // Plain text — accumulate
        let text = '';
        while (
          i < len &&
          rtf[i] !== '\\' &&
          rtf[i] !== '{' &&
          rtf[i] !== '}' &&
          rtf[i] !== '\r' &&
          rtf[i] !== '\n'
        ) {
          text += rtf[i];
          i++;
        }
        if (text) {
          tokens.push({ type: 'text', value: text });
        }
      }
    }

    return tokens;
  }

  /**
   * Converte token RTF in HTML preservando la formattazione.
   * Usa uno stack di stati per gestire i gruppi {} e le destinazioni da saltare.
   */
  private tokensToHtml(tokens: RtfToken[]): string {
    const output: string[] = [];
    const stateStack: RtfParserState[] = [];
    let state = this.createDefaultState();
    let skipDepth = 0; // > 0 means we're inside a destination group to skip
    let paragraphOpen = false;
    // Track destination groups that should be skipped (fonttbl, colortbl, etc.)
    const skipDestinations = new Set([
      'fonttbl',
      'colortbl',
      'stylesheet',
      'info',
      'pict',
      'header',
      'footer',
      'headerl',
      'headerr',
      'footerl',
      'footerr',
      'footnote',
      'annotation',
      'field',
      'fldinst',
    ]);

    const openParagraph = (): void => {
      if (!paragraphOpen) {
        output.push('<p>');
        paragraphOpen = true;
      }
    };

    const closeParagraph = (): void => {
      if (paragraphOpen) {
        output.push('</p>\n');
        paragraphOpen = false;
      }
    };

    let unicodeSkipRemaining = 0; // fallback bytes to skip after \uN

    const emitFormattedText = (text: string): void => {
      if (!text) return;
      openParagraph();
      let html = this.escapeHtml(text);
      if (state.bold) html = `<strong>${html}</strong>`;
      if (state.italic) html = `<em>${html}</em>`;
      if (state.underline) html = `<u>${html}</u>`;
      if (state.strikethrough) html = `<s>${html}</s>`;
      if (state.superscript) html = `<sup>${html}</sup>`;
      if (state.subscript) html = `<sub>${html}</sub>`;
      // Map large font sizes to heading tags via post-processing would be complex;
      // instead we use inline style for non-default sizes
      if (state.fontSize > 0 && state.fontSize !== 24) {
        const ptSize = state.fontSize / 2;
        html = `<span style="font-size:${ptSize}pt">${html}</span>`;
      }
      output.push(html);
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'group-open') {
        if (skipDepth > 0) {
          skipDepth++;
          continue;
        }
        // Push current state
        stateStack.push({ ...state });
        // Check if next token is a skip destination
        const next = tokens[i + 1];
        if (next && next.type === 'control' && skipDestinations.has(next.word!)) {
          skipDepth = 1;
          continue;
        }
        continue;
      }

      if (token.type === 'group-close') {
        if (skipDepth > 0) {
          skipDepth--;
          continue;
        }
        // Pop state
        if (stateStack.length > 0) {
          state = stateStack.pop()!;
        }
        continue;
      }

      if (skipDepth > 0) continue;

      if (token.type === 'control') {
        const word = token.word!;
        const param = token.param;

        switch (word) {
          case 'rtf':
          case 'ansi':
          case 'ansicpg':
          case 'deff':
          case 'deflang':
          case 'viewkind':
            // Document-level control words — skip
            break;
          case 'b':
            state.bold = param !== 0; // \b turns on, \b0 turns off
            break;
          case 'i':
            state.italic = param !== 0;
            break;
          case 'ul':
            state.underline = true;
            break;
          case 'ulnone':
            state.underline = false;
            break;
          case 'strike':
            state.strikethrough = param !== 0;
            break;
          case 'super':
            state.superscript = true;
            state.subscript = false;
            break;
          case 'sub':
            state.subscript = true;
            state.superscript = false;
            break;
          case 'nosupersub':
            state.superscript = false;
            state.subscript = false;
            break;
          case 'plain':
            state.bold = false;
            state.italic = false;
            state.underline = false;
            state.strikethrough = false;
            state.superscript = false;
            state.subscript = false;
            state.fontSize = 0;
            break;
          case 'uc':
            state.unicodeSkipCount = param ?? 1;
            break;
          case 'fs':
            state.fontSize = param ?? 0; // font size in half-points
            break;
          case 'par':
          case 'pard':
            closeParagraph();
            if (word === 'pard') {
              // Reset paragraph formatting
              state.bold = false;
              state.italic = false;
              state.underline = false;
            }
            break;
          case 'line':
            if (paragraphOpen) {
              output.push('<br>');
            }
            break;
          case 'tab':
            emitFormattedText('\t');
            break;
          case 'bullet':
            emitFormattedText('\u2022 ');
            break;
          case 'lquote':
            emitFormattedText('\u2018');
            break;
          case 'rquote':
            emitFormattedText('\u2019');
            break;
          case 'ldblquote':
            emitFormattedText('\u201C');
            break;
          case 'rdblquote':
            emitFormattedText('\u201D');
            break;
          case 'emdash':
            emitFormattedText('\u2014');
            break;
          case 'endash':
            emitFormattedText('\u2013');
            break;
          case 'f':
          case 'cf':
          case 'cb':
          case 'highlight':
          case 'lang':
          case 'sl':
          case 'slmult':
          case 'li':
          case 'ri':
          case 'fi':
          case 'sa':
          case 'sb':
          case 'qc':
          case 'qr':
          case 'ql':
          case 'qj':
          case 'nowidctlpar':
          case 'widctlpar':
          case 'ltrpar':
          case 'rtlpar':
            // Known formatting control words we don't convert — skip silently
            break;
          default:
            // Unknown control word — skip
            break;
        }
        continue;
      }

      if (token.type === 'unicode') {
        emitFormattedText(token.value!);
        // Skip the next `unicodeSkipCount` text tokens (ANSI fallback bytes)
        unicodeSkipRemaining = state.unicodeSkipCount;
        continue;
      }

      if (token.type === 'text') {
        if (unicodeSkipRemaining > 0) {
          // Skip ANSI fallback characters after a \uN token
          const skip = Math.min(unicodeSkipRemaining, token.value!.length);
          unicodeSkipRemaining -= skip;
          const remaining = token.value!.substring(skip);
          if (remaining) {
            emitFormattedText(remaining);
          }
        } else {
          emitFormattedText(token.value!);
        }
      }
    }

    closeParagraph();

    return output.join('');
  }

  /**
   * Estrae testo puro da RTF usando il tokenizer strutturato.
   * Preserva separazione paragrafi e line break.
   * @param rtf Contenuto RTF
   * @returns Testo puro
   */
  rtfToText(rtf: string): string {
    try {
      if (!rtf.trim().startsWith('{\\rtf')) {
        throw new Error('Invalid RTF format: must start with {\\rtf');
      }

      const tokens = this.tokenizeRtf(rtf);
      return this.tokensToText(tokens);
    } catch (error) {
      throw new Error(
        `Failed to extract text from RTF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte token RTF in testo puro, skippando i gruppi destinazione.
   */
  private tokensToText(tokens: RtfToken[]): string {
    const parts: string[] = [];
    let skipDepth = 0;
    let unicodeSkipCount = 1;
    let unicodeSkipRemaining = 0;
    const skipDestinations = new Set([
      'fonttbl',
      'colortbl',
      'stylesheet',
      'info',
      'pict',
      'header',
      'footer',
      'headerl',
      'headerr',
      'footerl',
      'footerr',
      'footnote',
      'annotation',
      'field',
      'fldinst',
    ]);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'group-open') {
        if (skipDepth > 0) {
          skipDepth++;
          continue;
        }
        const next = tokens[i + 1];
        if (next && next.type === 'control' && skipDestinations.has(next.word!)) {
          skipDepth = 1;
        }
        continue;
      }

      if (token.type === 'group-close') {
        if (skipDepth > 0) {
          skipDepth--;
          continue;
        }
        continue;
      }

      if (skipDepth > 0) continue;

      if (token.type === 'control') {
        switch (token.word) {
          case 'par':
          case 'pard':
            parts.push('\n\n');
            break;
          case 'line':
            parts.push('\n');
            break;
          case 'tab':
            parts.push('\t');
            break;
          case 'uc':
            unicodeSkipCount = token.param ?? 1;
            break;
          case 'bullet':
            parts.push('\u2022 ');
            break;
          case 'lquote':
            parts.push('\u2018');
            break;
          case 'rquote':
            parts.push('\u2019');
            break;
          case 'ldblquote':
            parts.push('\u201C');
            break;
          case 'rdblquote':
            parts.push('\u201D');
            break;
          case 'emdash':
            parts.push('\u2014');
            break;
          case 'endash':
            parts.push('\u2013');
            break;
        }
        continue;
      }

      if (token.type === 'unicode') {
        parts.push(token.value!);
        unicodeSkipRemaining = unicodeSkipCount;
        continue;
      }

      if (token.type === 'text') {
        if (unicodeSkipRemaining > 0) {
          const skip = Math.min(unicodeSkipRemaining, token.value!.length);
          unicodeSkipRemaining -= skip;
          const remaining = token.value!.substring(skip);
          if (remaining) {
            parts.push(remaining);
          }
        } else {
          parts.push(token.value!);
        }
      }
    }

    // Clean up: collapse multiple newlines, trim
    return parts
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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
