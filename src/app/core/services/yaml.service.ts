import { Injectable } from '@angular/core';

/**
 * Opzioni per parsing YAML
 */
export interface YamlParseOptions {
  /**
   * Schema da usare: 'core' (default), 'json', 'yaml-1.1'
   */
  schema?: 'core' | 'json' | 'failsafe';
  /**
   * Converti stringhe "on", "off", "yes", "no" in boolean
   */
  strict?: boolean;
}

/**
 * Opzioni per serializzazione YAML
 */
export interface YamlStringifyOptions {
  /**
   * Numero di spazi per indentazione (default: 2)
   */
  indent?: number;
  /**
   * Usa flow style (JSON-like) invece di block style
   */
  flowLevel?: number;
  /**
   * Sort keys alfabeticamente
   */
  sortKeys?: boolean;
  /**
   * Line width per wrapping (default: 80)
   */
  lineWidth?: number;
}

/**
 * Service per conversioni YAML
 * - JSON ↔ YAML
 * - YAML → TXT
 * - Validazione YAML
 *
 * Usa la libreria 'yaml' by eemeli (YAML 1.2 spec compliant)
 */
@Injectable({
  providedIn: 'root',
})
export class YamlService {
  /**
   * Converte YAML in JSON
   * @param yaml Stringa YAML
   * @param options Opzioni di parsing
   * @returns Oggetto JavaScript (parsable come JSON)
   */
  async yamlToJson(yaml: string, options: YamlParseOptions = {}): Promise<unknown> {
    try {
      // Lazy load yaml library
      const YAML = await import('yaml');

      const parseOptions: Record<string, unknown> = {};

      // Schema selection
      if (options.schema === 'json') {
        parseOptions['schema'] = 'json';
      } else if (options.schema === 'failsafe') {
        parseOptions['schema'] = 'failsafe';
      }
      // 'core' è il default, non serve specificarlo

      // Strict mode
      if (options.strict) {
        parseOptions['strict'] = true;
      }

      const parsed = YAML.parse(yaml, parseOptions);

      if (parsed === null || parsed === undefined) {
        throw new Error('YAML parsing resulted in null/undefined');
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converte JSON in YAML
   * @param json Oggetto JavaScript o stringa JSON
   * @param options Opzioni di serializzazione
   * @returns Stringa YAML
   */
  async jsonToYaml(json: unknown, options: YamlStringifyOptions = {}): Promise<string> {
    try {
      // Lazy load yaml library
      const YAML = await import('yaml');

      // Se è stringa, parsala prima
      const data = typeof json === 'string' ? JSON.parse(json) : json;

      const stringifyOptions: Record<string, unknown> = {
        indent: options.indent ?? 2,
        lineWidth: options.lineWidth ?? 80,
      };

      if (options.flowLevel !== undefined) {
        stringifyOptions['flowLevel'] = options.flowLevel;
      }

      if (options.sortKeys) {
        stringifyOptions['sortMapEntries'] = true;
      }

      const yamlString = YAML.stringify(data, stringifyOptions);

      return yamlString;
    } catch (error) {
      throw new Error(
        `Failed to convert JSON to YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Valida sintassi YAML
   * @param yaml Stringa YAML da validare
   * @returns Array di errori (vuoto se valido)
   */
  async validateYaml(yaml: string): Promise<Array<{ line: number; message: string }>> {
    try {
      // Lazy load yaml library
      const YAML = await import('yaml');

      const errors: Array<{ line: number; message: string }> = [];

      try {
        YAML.parse(yaml);
      } catch (error: unknown) {
        // YAML library fornisce informazioni dettagliate sugli errori
        const yamlError = error as { linePos?: { line: number }[]; message?: string };
        const lineNumber = yamlError.linePos?.[0]?.line ?? 0;
        const message = yamlError.message || 'Unknown YAML error';
        errors.push({ line: lineNumber, message });
      }

      return errors;
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
   * Converte YAML in testo formattato (human-readable)
   * @param yaml Stringa YAML
   * @returns Testo formattato
   */
  async yamlToText(yaml: string): Promise<string> {
    try {
      // Parse YAML to object
      const data = await this.yamlToJson(yaml);

      // Convert to pretty-printed text
      return this.objectToText(data);
    } catch (error) {
      throw new Error(
        `Failed to convert YAML to text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Beautify YAML (re-format con indentazione consistente)
   * @param yaml YAML da formattare
   * @param options Opzioni di formattazione
   * @returns YAML formattato
   */
  async beautifyYaml(yaml: string, options: YamlStringifyOptions = {}): Promise<string> {
    try {
      // Parse and re-stringify per normalizzare formattazione
      const data = await this.yamlToJson(yaml);
      return this.jsonToYaml(data, options);
    } catch (error) {
      throw new Error(
        `Failed to beautify YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
   * Detect se una stringa è YAML valido
   * @param content Contenuto da verificare
   * @returns true se è YAML valido
   */
  async isValidYaml(content: string): Promise<boolean> {
    const errors = await this.validateYaml(content);
    return errors.length === 0;
  }

  /**
   * Converti CSV-like YAML in array
   * Utile per YAML che rappresenta dati tabulari
   * @param yaml YAML sorgente
   * @returns Array di oggetti
   */
  async yamlToArray(yaml: string): Promise<unknown[]> {
    try {
      const data = await this.yamlToJson(yaml);

      if (Array.isArray(data)) {
        return data;
      }

      // Se è oggetto, converti in array di entries
      if (typeof data === 'object' && data !== null) {
        return Object.entries(data).map(([key, value]) => ({ key, value }));
      }

      // Se è primitivo, wrappa in array
      return [data];
    } catch (error) {
      throw new Error(
        `Failed to convert YAML to array: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Merge multipli documenti YAML (separati da ---)
   * @param yaml YAML multi-document
   * @returns Array di oggetti parsed
   */
  async parseMultiDocument(yaml: string): Promise<unknown[]> {
    try {
      const YAML = await import('yaml');

      const documents = YAML.parseAllDocuments(yaml);
      return documents.map((doc) => doc.toJSON());
    } catch (error) {
      throw new Error(
        `Failed to parse multi-document YAML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
