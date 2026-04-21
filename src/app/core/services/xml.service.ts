import { Injectable } from '@angular/core';

/**
 * Opzioni per parsing XML
 */
export interface XmlParseOptions {
  /**
   * Preserva attributi come proprietà con prefisso @ (default: true)
   */
  ignoreAttributes?: boolean;
  /**
   * Prefisso per attributi nel JSON risultante (default: '@_')
   */
  attributeNamePrefix?: string;
  /**
   * Converti valori in tipi nativi (number, boolean) (default: true)
   */
  parseAttributeValue?: boolean;
  /**
   * Preserva ordine dei tag (default: false per performance)
   */
  preserveOrder?: boolean;
  /**
   * Remove namespace da tag names (default: false)
   */
  removeNSPrefix?: boolean;
  /**
   * Parse tag values come numeri/boolean se possibile (default: true)
   */
  parseTagValue?: boolean;
}

/**
 * Opzioni per generazione XML da JSON
 */
export interface XmlBuildOptions {
  /**
   * Prefisso attributi nel JSON sorgente (default: '@_')
   */
  attributeNamePrefix?: string;
  /**
   * Indentazione (default: 2 spazi)
   */
  format?: boolean;
  /**
   * Numero spazi indentazione se format=true (default: 2)
   */
  indentBy?: string;
  /**
   * Ignora attributi nel JSON (default: false)
   */
  ignoreAttributes?: boolean;
  /**
   * Suppress XML declaration <?xml version="1.0"?> (default: false)
   */
  suppressEmptyNode?: boolean;
}

/**
 * Service per conversioni XML
 * - XML ↔ JSON
 * - XML → HTML
 * - Validazione XML
 *
 * Usa la libreria 'fast-xml-parser' (veloce e completa)
 */
@Injectable({
  providedIn: 'root',
})
export class XmlService {
  /**
   * Converte XML in JSON
   * @param xml Stringa XML
   * @param options Opzioni di parsing
   * @returns Oggetto JavaScript
   */
  async xmlToJson(xml: string, options: XmlParseOptions = {}): Promise<unknown> {
    try {
      // Lazy load fast-xml-parser
      const { XMLParser, XMLValidator } = await import('fast-xml-parser');

      const validationResult = XMLValidator.validate(xml, {
        allowBooleanAttributes: true,
      });
      if (validationResult !== true) {
        const error = validationResult as { err?: { line?: number; msg?: string } };
        throw new Error(error.err?.msg || 'Invalid XML');
      }

      const parserOptions = {
        ignoreAttributes: options.ignoreAttributes ?? false,
        attributeNamePrefix: options.attributeNamePrefix ?? '@_',
        parseAttributeValue: options.parseAttributeValue ?? true,
        parseTagValue: options.parseTagValue ?? true,
        preserveOrder: options.preserveOrder ?? false,
        removeNSPrefix: options.removeNSPrefix ?? false,
        trimValues: true,
        parseTrueNumberOnly: false, // Parse anche "123" come number
      };

      const parser = new XMLParser(parserOptions);
      const result = parser.parse(xml);

      if (result === null || result === undefined) {
        throw new Error('XML parsing resulted in null/undefined');
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte JSON in XML
   * @param json Oggetto JavaScript o stringa JSON
   * @param options Opzioni di generazione
   * @returns Stringa XML
   */
  async jsonToXml(json: unknown, options: XmlBuildOptions = {}): Promise<string> {
    try {
      // Lazy load fast-xml-parser
      const { XMLBuilder } = await import('fast-xml-parser');

      // Se è stringa, parsala prima
      const data = typeof json === 'string' ? JSON.parse(json) : json;

      const builderOptions = {
        attributeNamePrefix: options.attributeNamePrefix ?? '@_',
        ignoreAttributes: options.ignoreAttributes ?? false,
        format: options.format ?? true,
        indentBy: options.indentBy ?? '  ',
        suppressEmptyNode: options.suppressEmptyNode ?? false,
      };

      const builder = new XMLBuilder(builderOptions);
      let xmlString = builder.build(data);

      // Aggiungi XML declaration se non presente
      if (!xmlString.startsWith('<?xml')) {
        xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
      }

      return xmlString;
    } catch (error) {
      throw new Error(
        `Failed to convert JSON to XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Valida sintassi XML
   * @param xml Stringa XML da validare
   * @returns Array di errori (vuoto se valido)
   */
  async validateXml(xml: string): Promise<Array<{ line: number; message: string }>> {
    try {
      // Lazy load fast-xml-parser validator
      const { XMLValidator } = await import('fast-xml-parser');

      const result = XMLValidator.validate(xml, {
        allowBooleanAttributes: true,
      });

      if (result === true) {
        return []; // Valido
      }

      // Errore di validazione
      const error = result as { err?: { line?: number; msg?: string } };
      return [
        {
          line: error.err?.line ?? 0,
          message: error.err?.msg || 'Unknown XML validation error',
        },
      ];
    } catch (error) {
      return [
        {
          line: 0,
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ];
    }
  }

  /**
   * Converte XML in HTML visualizzabile
   * @param xml Stringa XML
   * @returns HTML con XML syntax-highlighted
   */
  async xmlToHtml(xml: string): Promise<string> {
    try {
      // Beautify XML prima
      const beautified = await this.beautifyXml(xml);

      // Escape HTML
      const escaped = this.escapeHtml(beautified);

      // Wrap in HTML con syntax highlighting basico
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XML Document</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 20px;
      margin: 0;
    }
    pre {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
      line-height: 1.5;
    }
    .xml-tag { color: #0066cc; }
    .xml-attr { color: #994500; }
    .xml-value { color: #009900; }
  </style>
</head>
<body>
  <pre><code>${escaped}</code></pre>
</body>
</html>`;
    } catch (error) {
      throw new Error(
        `Failed to convert XML to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Beautify XML (formattazione con indentazione)
   * @param xml XML da formattare
   * @param indent Numero di spazi per indentazione (default: 2)
   * @returns XML formattato
   */
  async beautifyXml(xml: string, indent: number = 2): Promise<string> {
    try {
      // Parse to JSON and back to XML con formatting
      const json = await this.xmlToJson(xml);
      return this.jsonToXml(json, {
        format: true,
        indentBy: ' '.repeat(indent),
      });
    } catch (error) {
      throw new Error(
        `Failed to beautify XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Minify XML (rimuovi whitespace non necessario)
   * @param xml XML da minificare
   * @returns XML minificato
   */
  async minifyXml(xml: string): Promise<string> {
    try {
      // Parse to JSON and back to XML senza formatting
      const json = await this.xmlToJson(xml);
      return this.jsonToXml(json, { format: false });
    } catch (error) {
      throw new Error(
        `Failed to minify XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte XML in testo leggibile
   * @param xml Stringa XML
   * @returns Testo formattato
   */
  async xmlToText(xml: string): Promise<string> {
    try {
      // Parse to JSON
      const json = await this.xmlToJson(xml);

      // Convert to readable text
      return this.objectToText(json);
    } catch (error) {
      throw new Error(
        `Failed to convert XML to text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect se una stringa è XML valido
   * @param content Contenuto da verificare
   * @returns true se è XML valido
   */
  async isValidXml(content: string): Promise<boolean> {
    const errors = await this.validateXml(content);
    return errors.length === 0;
  }

  /**
   * Estrai namespace da XML
   * @param xml Stringa XML
   * @returns Map di namespace (prefix → URI)
   */
  extractNamespaces(xml: string): Map<string, string> {
    const namespaces = new Map<string, string>();

    // Accetta sia virgolette doppie che apici singoli, entrambi validi in XML.
    const nsRegex = /xmlns(?::([a-zA-Z0-9]+))?=(?:"([^"]*)"|'([^']*)')/g;
    let match;

    while ((match = nsRegex.exec(xml)) !== null) {
      const prefix = match[1] || 'default';
      const uri = match[2] ?? match[3] ?? '';
      namespaces.set(prefix, uri);
    }

    return namespaces;
  }

  /**
   * Converte oggetto JavaScript in testo human-readable
   * @param obj Oggetto da convertire
   * @param indent Livello di indentazione
   * @returns Testo formattato
   */
  private objectToText(obj: unknown, indent: number = 0): string {
    const spacing = '  '.repeat(indent);
    const lines: string[] = [];

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spacing}[${index}]:`);
          lines.push(this.objectToText(item, indent + 1));
        } else {
          lines.push(`${spacing}[${index}]: ${item}`);
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        // Skip attributi (prefix @_)
        if (key.startsWith('@_')) {
          return;
        }

        if (typeof value === 'object' && value !== null) {
          lines.push(`${spacing}${key}:`);
          lines.push(this.objectToText(value, indent + 1));
        } else {
          lines.push(`${spacing}${key}: ${value}`);
        }
      });
    } else {
      lines.push(`${spacing}${obj}`);
    }

    return lines.join('\n');
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
}
