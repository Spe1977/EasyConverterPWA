import { Injectable } from '@angular/core';
import DOMPurify from 'dompurify';
import juice from 'juice';

/**
 * Opzioni per sanitization HTML
 */
export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: string[] | { [key: string]: string[] };
  allowedSchemes?: string[];
  keepComments?: boolean;
}

/**
 * Opzioni per minification HTML
 */
export interface MinifyOptions {
  collapseWhitespace?: boolean;
  removeComments?: boolean;
  removeAttributeQuotes?: boolean;
  minifyCSS?: boolean;
  minifyJS?: boolean;
}

/**
 * Service per operazioni avanzate su HTML
 * - Sanitization (XSS protection)
 * - CSS inline (email-ready)
 * - Minification
 */
@Injectable({
  providedIn: 'root',
})
export class HtmlService {
  private readonly defaultAllowedTags = [
    'html',
    'head',
    'body',
    'meta',
    'title',
    'style',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'div',
    'span',
    'a',
    'ul',
    'ol',
    'li',
    'b',
    'i',
    'strong',
    'em',
    'br',
    'hr',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'blockquote',
    'pre',
    'code',
  ];
  private readonly defaultAllowedAttributes = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    meta: ['charset', 'name', 'content'],
    '*': ['class', 'id', 'style'],
  } satisfies Record<string, string[]>;

  /**
   * Sanitizza HTML per rimuovere script e contenuti pericolosi (XSS protection)
   * @param html HTML da sanitizzare
   * @param options Opzioni di sanitization
   * @returns HTML sanitizzato
   */
  sanitize(html: string, options: SanitizeOptions = {}): string {
    const isWholeDocument = /<!doctype\s+html|<html[\s>]/i.test(html);
    const config: Record<string, unknown> = {
      ALLOWED_TAGS: options.allowedTags || this.defaultAllowedTags,
      ALLOWED_ATTR: this.normalizeAllowedAttributes(options.allowedAttributes),
      ALLOWED_URI_REGEXP: options.allowedSchemes
        ? new RegExp(`^(${options.allowedSchemes.join('|')}):`, 'i')
        : /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      WHOLE_DOCUMENT: isWholeDocument,
    };

    if (options.keepComments !== true) {
      html = html.replace(/<!--[\s\S]*?-->/g, '');
    }

    return String(DOMPurify.sanitize(html, config));
  }

  private normalizeAllowedAttributes(
    allowedAttributes?: SanitizeOptions['allowedAttributes']
  ): string[] {
    if (Array.isArray(allowedAttributes)) {
      return [...new Set(allowedAttributes)];
    }

    const source = allowedAttributes || this.defaultAllowedAttributes;
    return [...new Set(Object.values(source).flat())];
  }

  /**
   * Converte CSS esterno/interno in inline styles (per email HTML)
   * @param html HTML con CSS esterno o <style>
   * @param options Opzioni juice
   * @returns HTML con CSS inline
   */
  inlineCss(
    html: string,
    options: {
      removeStyleTags?: boolean;
      preserveMediaQueries?: boolean;
      preserveFontFaces?: boolean;
    } = {}
  ): string {
    return juice(html, {
      removeStyleTags: options.removeStyleTags ?? true,
      preserveMediaQueries: options.preserveMediaQueries ?? false,
      preserveFontFaces: options.preserveFontFaces ?? false,
      applyStyleTags: true,
      webResources: {
        images: false, // Non scaricare immagini remote
        scripts: false,
        links: false,
      },
    });
  }

  /**
   * Minifica HTML rimuovendo spazi, commenti, etc (implementazione browser-compatible)
   * @param html HTML da minificare
   * @param options Opzioni di minification
   * @returns HTML minificato
   */
  async minifyHtml(html: string, options: MinifyOptions = {}): Promise<string> {
    let minified = html;

    // Rimuovi commenti HTML (tranne IE conditional comments)
    if (options.removeComments ?? true) {
      minified = minified.replace(/<!--(?!\[if\s)(?!<!)[^\[].*?-->/gs, '');
    }

    // Collapse whitespace (conservativo)
    if (options.collapseWhitespace ?? true) {
      // Rimuovi spazi multipli
      minified = minified.replace(/\s+/g, ' ');
      // Rimuovi spazi prima/dopo tag
      minified = minified.replace(/>\s+</g, '><');
      // Rimuovi spazi a inizio/fine linee
      minified = minified.replace(/^\s+|\s+$/gm, '');
    }

    return minified.trim();
  }

  /**
   * Pipeline completa: sanitize → inline CSS → minify
   * Utile per preparare HTML per email o embedding sicuro
   * @param html HTML sorgente
   * @param options Opzioni per ogni step
   * @returns HTML processato
   */
  async processForEmail(
    html: string,
    options: {
      sanitize?: boolean;
      inlineCss?: boolean;
      minify?: boolean;
    } = {}
  ): Promise<string> {
    let processed = html;

    // Step 1: Sanitize (opzionale, default true per sicurezza)
    if (options.sanitize !== false) {
      processed = this.sanitize(processed);
    }

    // Step 2: Inline CSS (default true per email)
    if (options.inlineCss !== false) {
      processed = this.inlineCss(processed);
    }

    // Step 3: Minify (opzionale, default false per preservare leggibilità)
    if (options.minify === true) {
      processed = await this.minifyHtml(processed);
    }

    return processed;
  }

  /**
   * Valida HTML e rileva problemi comuni
   * @param html HTML da validare
   * @returns Lista di warning/errori
   */
  validateHtml(html: string): Array<{ type: 'error' | 'warning'; message: string }> {
    const issues: Array<{ type: 'error' | 'warning'; message: string }> = [];

    // Check for script tags (security risk)
    if (/<script\b[^>]*>/i.test(html)) {
      issues.push({
        type: 'error',
        message: 'HTML contains <script> tags - potential security risk',
      });
    }

    // Check for inline event handlers (security risk)
    if (/\son\w+\s*=/i.test(html)) {
      issues.push({
        type: 'error',
        message: 'HTML contains inline event handlers (onclick, onload, etc) - security risk',
      });
    }

    // Check for iframe (security risk)
    if (/<iframe\b[^>]*>/i.test(html)) {
      issues.push({
        type: 'warning',
        message: 'HTML contains <iframe> tags - may be security risk',
      });
    }

    // Check for external CSS links
    if (/<link[^>]*rel=["']stylesheet["'][^>]*>/i.test(html)) {
      issues.push({
        type: 'warning',
        message: 'HTML contains external CSS links - consider inlining for email compatibility',
      });
    }

    // Check for external JS
    if (/<script[^>]*src=/i.test(html)) {
      issues.push({
        type: 'error',
        message: 'HTML contains external JavaScript - not allowed',
      });
    }

    // Check for mailto: links without protocol
    if (/href=["'][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}["']/i.test(html)) {
      issues.push({
        type: 'warning',
        message: 'Email links should use mailto: protocol',
      });
    }

    return issues;
  }

  /**
   * Estrai testo puro da HTML (strip tags)
   * @param html HTML sorgente
   * @returns Testo puro
   */
  extractText(html: string): string {
    // Sanitize prima per sicurezza
    const sanitized = this.sanitize(html);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitized;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Wrap testo puro in HTML base
   * @param text Testo puro
   * @param title Titolo del documento
   * @returns HTML completo
   */
  wrapInHtml(text: string, title: string = 'Document'): string {
    const escapedText = this.escapeHtml(text);
    const escapedTitle = this.escapeHtml(title);

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
</head>
<body>
  <pre>${escapedText}</pre>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters
   * @param text Testo da escape
   * @returns Testo escaped
   */
  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Unescape HTML entities
   * @param html HTML con entities
   * @returns Testo unescaped
   */
  unescapeHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  /**
   * Beautify HTML (opposto di minify)
   * Aggiunge indentazione per leggibilità
   * @param html HTML minificato
   * @returns HTML formattato
   */
  beautifyHtml(html: string): string {
    // Implementazione semplice: aggiungi newline dopo tag
    return html
      .replace(/(<\/[^>]+>)(<[^/])/g, '$1\n$2') // Newline dopo closing tag
      .replace(/(<[^/][^>]*>)([^<])/g, '$1\n$2') // Newline dopo opening tag
      .replace(/(<br\s*\/?>)/gi, '$1\n') // Newline dopo <br>
      .replace(/\n\s*\n/g, '\n'); // Rimuovi newline multiple
  }
}
