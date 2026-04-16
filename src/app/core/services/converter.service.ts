import { Injectable, inject } from '@angular/core';
import { EpubMetadata } from './epub.service';
import {
  ConversionFormat,
  ConversionPreflightResult,
  ConversionSupport,
  SUPPORTED_FORMATS,
} from '@core/models/conversion-format';
import {
  ConversionCancelledError,
  ConversionOptions,
  ConversionResult,
  ConversionTimeoutError,
  StructuredDataColumnNamingStrategy,
  StructuredDataExportProfile,
  StructuredDataPrimitiveArrayStrategy,
} from '@core/models/conversion-result';
import { environment } from '@env/environment';
import { PdfService } from './pdf.service';
import { ImageService } from './image.service';
import { EpubService } from './epub.service';
import { CsvService } from './csv.service';
import { HtmlService } from './html.service';
import { RtfService } from './rtf.service';
import { YamlService } from './yaml.service';
import { XmlService } from './xml.service';
import { Base64Service } from './base64.service';
import { SpreadsheetWorkerService } from './spreadsheet-worker.service';

interface TabularNormalizationResult {
  rows: Record<string, unknown>[];
  normalized: boolean;
}

interface StructuredSourcePipelineResult {
  parsed: unknown;
  collectionPaths: string[];
  tabular: TabularNormalizationResult | null;
}

interface StructuredDataNormalizationOptions {
  collectionPath: string | null;
  primitiveArrayStrategy: StructuredDataPrimitiveArrayStrategy;
  columnNaming: StructuredDataColumnNamingStrategy;
}

/**
 * Service principale per gestire tutte le conversioni tra formati
 * Coordina gli altri servizi specializzati (PDF, Image, ecc.)
 *
 * Note: Le librerie pesanti (XLSX, marked, turndown) sono lazy-loaded
 * per ridurre il bundle iniziale del 40% (~265 KB risparmiati)
 */
@Injectable({
  providedIn: 'root',
})
export class ConverterService {
  private readonly defaultStructuredDataOptions: StructuredDataNormalizationOptions = {
    collectionPath: null,
    primitiveArrayStrategy: 'join',
    columnNaming: 'dot',
  };

  private pdfService = inject(PdfService);
  private imageService = inject(ImageService);
  private epubService = inject(EpubService);
  private csvService = inject(CsvService);
  private htmlService = inject(HtmlService);
  private rtfService = inject(RtfService);
  private yamlService = inject(YamlService);
  private xmlService = inject(XmlService);
  private base64Service = inject(Base64Service);
  private spreadsheetWorkerService = inject(SpreadsheetWorkerService);

  // Lazy-loaded libraries (cached after first load)
  private turndownServiceInstance?: { turndown(html: string): string };
  private markedModule?: typeof import('marked');
  private readonly supportedConversions: Record<ConversionFormat, ConversionSupport[]> = {
    [ConversionFormat.TXT]: [
      { target: ConversionFormat.MD, reliability: 'text-only' },
      { target: ConversionFormat.HTML, reliability: 'text-only' },
      { target: ConversionFormat.CSV, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'text-only' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.MD]: [
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.HTML, reliability: 'structured' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.EPUB, reliability: 'structured' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.HTML]: [
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.MD, reliability: 'best-effort' },
      { target: ConversionFormat.RTF, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.EPUB, reliability: 'structured' },
      { target: ConversionFormat.CSV, reliability: 'table-only' },
      { target: ConversionFormat.XLSX, reliability: 'table-only' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.RTF]: [
      { target: ConversionFormat.HTML, reliability: 'structured' },
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.MD, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.CSV]: [
      { target: ConversionFormat.JSON, reliability: 'structured' },
      { target: ConversionFormat.XLSX, reliability: 'structured' },
      { target: ConversionFormat.YAML, reliability: 'structured' },
      { target: ConversionFormat.XML, reliability: 'structured' },
      { target: ConversionFormat.HTML, reliability: 'table-only' },
      { target: ConversionFormat.MD, reliability: 'table-only' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.JSON]: [
      { target: ConversionFormat.CSV, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.XLSX, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.YAML, reliability: 'structured' },
      { target: ConversionFormat.XML, reliability: 'structured' },
      { target: ConversionFormat.HTML, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.TXT, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.XLSX]: [
      { target: ConversionFormat.CSV, reliability: 'structured' },
      { target: ConversionFormat.JSON, reliability: 'structured' },
      { target: ConversionFormat.YAML, reliability: 'structured' },
      { target: ConversionFormat.XML, reliability: 'structured' },
      { target: ConversionFormat.HTML, reliability: 'table-only' },
      { target: ConversionFormat.MD, reliability: 'table-only' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.ODS]: [
      { target: ConversionFormat.CSV, reliability: 'structured' },
      { target: ConversionFormat.JSON, reliability: 'structured' },
      { target: ConversionFormat.XLSX, reliability: 'structured' },
      { target: ConversionFormat.YAML, reliability: 'structured' },
      { target: ConversionFormat.XML, reliability: 'structured' },
      { target: ConversionFormat.HTML, reliability: 'table-only' },
      { target: ConversionFormat.MD, reliability: 'table-only' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.YAML]: [
      { target: ConversionFormat.JSON, reliability: 'structured' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.XML]: [
      { target: ConversionFormat.JSON, reliability: 'structured' },
      { target: ConversionFormat.YAML, reliability: 'structured' },
      { target: ConversionFormat.CSV, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.XLSX, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.HTML, reliability: 'requires-uniform-data' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.BASE64]: [{ target: ConversionFormat.TXT, reliability: 'best-effort' }],
    [ConversionFormat.PDF]: [
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.MD, reliability: 'text-only' },
      { target: ConversionFormat.HTML, reliability: 'text-only' },
      { target: ConversionFormat.PNG, reliability: 'best-effort' },
      { target: ConversionFormat.JPEG, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.PNG]: [
      { target: ConversionFormat.JPEG, reliability: 'best-effort' },
      { target: ConversionFormat.WEBP, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.JPEG]: [
      { target: ConversionFormat.PNG, reliability: 'best-effort' },
      { target: ConversionFormat.WEBP, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.JPG]: [
      { target: ConversionFormat.PNG, reliability: 'best-effort' },
      { target: ConversionFormat.WEBP, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.WEBP]: [
      { target: ConversionFormat.PNG, reliability: 'best-effort' },
      { target: ConversionFormat.JPEG, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
    [ConversionFormat.EPUB]: [
      { target: ConversionFormat.HTML, reliability: 'structured' },
      { target: ConversionFormat.TXT, reliability: 'text-only' },
      { target: ConversionFormat.MD, reliability: 'best-effort' },
      { target: ConversionFormat.PDF, reliability: 'best-effort' },
      { target: ConversionFormat.RTF, reliability: 'best-effort' },
      { target: ConversionFormat.BASE64, reliability: 'lossless' },
    ],
  };

  /**
   * Converte un file da un formato all'altro
   * @param file File da convertire
   * @param sourceFormat Formato di partenza
   * @param targetFormat Formato di destinazione
   * @param options Opzioni di conversione
   * @returns Risultato della conversione
   */
  async convert(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    try {
      const startTime = Date.now();

      // Verifica che la conversione sia supportata
      if (!this.isConversionSupported(sourceFormat, targetFormat)) {
        throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} is not supported`);
      }

      // Per EPUB: estrai metadata per titoli output migliori
      let fileName: string;
      let epubMetadata: EpubMetadata | undefined;
      if (sourceFormat === ConversionFormat.EPUB) {
        try {
          epubMetadata = await this.epubService.extractMetadataFromEpub(file);
          fileName = this.generateFileNameFromEpubMetadata(epubMetadata, targetFormat);
        } catch {
          // Fallback al nome file originale se l'estrazione metadata fallisce
          fileName = this.generateFileName(file.name, targetFormat);
        }
      } else {
        fileName = this.generateFileName(file.name, targetFormat);
      }

      const timeoutMs = this.getTimeoutForFormat(sourceFormat);

      const conversionWork = this.executeConversion(file, sourceFormat, targetFormat, {
        ...options,
        _epubMetadata: epubMetadata,
      });
      const blob = await this.raceWithTimeout(conversionWork, timeoutMs, options.signal);

      const duration = Date.now() - startTime;

      return {
        blob,
        fileName,
        mimeType: this.getMimeType(targetFormat),
        size: blob.size,
        success: true,
        duration,
        metadata: epubMetadata
          ? {
              epubTitle: epubMetadata.title,
              epubAuthor: epubMetadata.author,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof ConversionCancelledError) {
        return { success: false, error: error.message };
      }
      if (error instanceof ConversionTimeoutError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async executeConversion(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    if (this.isImageFormat(sourceFormat)) {
      return this.convertFromImage(file, sourceFormat, targetFormat, options);
    } else if (this.isDocumentFormat(sourceFormat)) {
      return this.convertFromDocument(file, sourceFormat, targetFormat, options);
    } else if (this.isSpreadsheetFormat(sourceFormat)) {
      return this.convertFromSpreadsheet(file, sourceFormat, targetFormat, options);
    } else if (this.isDataFormat(sourceFormat)) {
      return this.convertFromDataFormat(file, sourceFormat, targetFormat, options);
    } else if (sourceFormat === ConversionFormat.BASE64) {
      return this.convertFromBase64(file, targetFormat, options);
    } else if (sourceFormat === ConversionFormat.PDF) {
      return this.convertFromPdf(file, targetFormat, options);
    } else if (sourceFormat === ConversionFormat.EPUB) {
      return this.convertFromEpub(file, targetFormat, options);
    }
    throw new Error(`Unsupported source format: ${sourceFormat}`);
  }

  private raceWithTimeout(
    conversionPromise: Promise<Blob>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      let settled = false;

      if (signal?.aborted) {
        reject(new ConversionCancelledError());
        return;
      }

      const onAbort = () => {
        if (!settled) {
          settled = true;
          reject(new ConversionCancelledError());
        }
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          reject(new ConversionTimeoutError(timeoutMs));
        }
      }, timeoutMs);

      conversionPromise
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            signal?.removeEventListener('abort', onAbort);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            signal?.removeEventListener('abort', onAbort);
            reject(error);
          }
        });
    });
  }

  getTimeoutForFormat(sourceFormat: ConversionFormat): number {
    const categoryTimeouts = environment.conversion.timeoutMsByCategory;
    const fallback = environment.conversion.timeoutMs;

    if (sourceFormat === ConversionFormat.PDF) return categoryTimeouts.pdf;
    if (this.isImageFormat(sourceFormat)) return categoryTimeouts.image;
    if (this.isSpreadsheetFormat(sourceFormat)) return categoryTimeouts.spreadsheet;
    if (this.isDocumentFormat(sourceFormat)) return categoryTimeouts.document;
    if (sourceFormat === ConversionFormat.EPUB) return categoryTimeouts.ebook;
    if (sourceFormat === ConversionFormat.BASE64) return categoryTimeouts.encoding;
    if (this.isDataFormat(sourceFormat)) return categoryTimeouts.data;

    return fallback;
  }

  /**
   * Lazy-load helper methods for heavy libraries
   */

  /**
   * Get marked function (lazy loaded, ~50 KB)
   * Cached after first load for performance
   */
  private async getMarked(): Promise<typeof import('marked').marked> {
    if (!this.markedModule) {
      this.markedModule = await import('marked');
    }
    return this.markedModule.marked;
  }

  /**
   * Get TurndownService instance (lazy loaded, ~50 KB)
   * Singleton pattern - instance created once and reused
   */
  private async getTurndownService(): Promise<{ turndown(html: string): string }> {
    if (!this.turndownServiceInstance) {
      const TurndownModule = await import('turndown');
      const TurndownService = TurndownModule.default || TurndownModule;
      this.turndownServiceInstance = new TurndownService();
    }
    return this.turndownServiceInstance;
  }

  /**
   * Conversioni DA formati immagine
   */
  private async convertFromImage(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    // Immagine -> Immagine
    if (this.isImageFormat(targetFormat)) {
      // Usa qualità adattiva se non specificata
      const quality = options.quality ?? null;
      const preserveExif = options.preserveExif ?? false;

      return this.imageService.convertImage(file, targetFormat, quality, preserveExif);
    }

    // Immagine -> PDF
    if (targetFormat === ConversionFormat.PDF) {
      // Converti sempre a PNG per evitare errori con JPEG corrotti o formati misti
      // PNG è più affidabile e supporta la trasparenza
      const pngBlob = await this.imageService.convertImage(file, ConversionFormat.PNG, 100, false);
      const pdfBytes = await this.pdfService.createPdfFromImage(pngBlob, 'png');
      return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    }

    // Immagine -> BASE64
    if (targetFormat === ConversionFormat.BASE64) {
      const imageBase64 = await this.base64Service.fileToBase64(file, options['base64Options']);
      return new Blob([imageBase64], { type: 'text/plain' });
    }

    throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} not implemented`);
  }

  /**
   * Conversioni DA formati documento (TXT, MD, HTML)
   */
  private async convertFromDocument(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const content = await this.readFileAsText(file);

    // TXT -> altri formati
    if (sourceFormat === ConversionFormat.TXT) {
      return this.convertFromTxt(content, targetFormat, options);
    }

    // MD -> altri formati
    if (sourceFormat === ConversionFormat.MD) {
      return this.convertFromMarkdown(content, targetFormat, options);
    }

    // HTML -> altri formati
    if (sourceFormat === ConversionFormat.HTML) {
      return this.convertFromHtml(content, targetFormat, options);
    }

    // RTF -> altri formati
    if (sourceFormat === ConversionFormat.RTF) {
      return this.convertFromRtf(content, targetFormat, options);
    }

    throw new Error(`Unsupported document format: ${sourceFormat}`);
  }

  /**
   * Conversioni DA TXT
   */
  private async convertFromTxt(
    content: string,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    switch (targetFormat) {
      case ConversionFormat.MD:
        // TXT -> MD (wrap in code block o paragrafi)
        const mdContent = content
          .split('\n')
          .map((line) => line.trim())
          .join('\n\n');
        return new Blob([mdContent], { type: 'text/markdown' });

      case ConversionFormat.HTML:
        // TXT -> HTML
        let htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body><pre>${this.escapeHtml(content)}</pre></body>
</html>`;
        htmlContent = await this.processHtmlOptions(htmlContent, options);
        return new Blob([htmlContent], { type: 'text/html' });

      case ConversionFormat.CSV:
        // TXT -> CSV (delimiter detection and normalization)
        return this.convertTxtToCsv(content);

      case ConversionFormat.PDF:
        // TXT -> PDF
        const pdfBytes = await this.pdfService.createPdfFromText(content, {
          fontSize: options['fontSize'] || 12,
        });
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.BASE64:
        // TXT -> BASE64
        const txtBlob = new Blob([content], { type: 'text/plain' });
        const base64String = await this.base64Service.fileToBase64(
          txtBlob,
          options['base64Options']
        );
        return new Blob([base64String], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from TXT to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA Markdown
   */
  private async convertFromMarkdown(
    content: string,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const marked = await this.getMarked();

    switch (targetFormat) {
      case ConversionFormat.TXT:
        // MD -> TXT (remove markdown syntax)
        const turndown = await this.getTurndownService();
        const txtContent = turndown.turndown(await marked(content));
        return new Blob([txtContent], { type: 'text/plain' });

      case ConversionFormat.HTML:
        // MD -> HTML
        let htmlContent = await marked(content);
        let fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body>${htmlContent}</body>
</html>`;

        // Apply HTML processing options
        fullHtml = await this.processHtmlOptions(fullHtml, options);

        return new Blob([fullHtml], { type: 'text/html' });

      case ConversionFormat.PDF:
        // MD -> HTML -> PDF
        const html = await marked(content);
        const pdfBytes = await this.pdfService.createPdfFromHtml(html);
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.EPUB:
        // MD -> EPUB
        return this.epubService.generateEpubFromMarkdown(content, 'Document');

      case ConversionFormat.BASE64:
        // MD -> BASE64
        const mdBlob = new Blob([content], { type: 'text/markdown' });
        const mdBase64 = await this.base64Service.fileToBase64(mdBlob, options['base64Options']);
        return new Blob([mdBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from MD to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA HTML
   */
  private async convertFromHtml(
    content: string,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    switch (targetFormat) {
      case ConversionFormat.TXT:
        // HTML -> TXT (strip tags)
        const tempDiv = document.createElement('div');
        // Sanitize HTML to prevent XSS before parsing
        const sanitized = this.htmlService.sanitize(content, {
          allowedTags: [], // Strip all tags, keep only text
        });
        tempDiv.innerHTML = sanitized;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return new Blob([text], { type: 'text/plain' });

      case ConversionFormat.MD:
        // HTML -> MD
        const turndown = await this.getTurndownService();
        const markdown = turndown.turndown(this.sanitizeHtmlForUntrustedInput(content));
        return new Blob([markdown], { type: 'text/markdown' });

      case ConversionFormat.RTF:
        // HTML -> RTF
        const rtfContent = await this.rtfService.htmlToRtf(
          this.sanitizeHtmlForUntrustedInput(content),
          options['rtfOptions']
        );
        return new Blob([rtfContent], { type: 'application/rtf' });

      case ConversionFormat.PDF:
        // HTML -> PDF
        const pdfBytes = await this.pdfService.createPdfFromHtml(
          this.sanitizeHtmlForUntrustedInput(content)
        );
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.EPUB:
        // HTML -> EPUB
        return this.epubService.generateEpubFromHtml(
          this.sanitizeHtmlForUntrustedInput(content),
          'Document'
        );

      case ConversionFormat.CSV:
      case ConversionFormat.XLSX:
        return this.convertHtmlTableToTabular(content, targetFormat);

      case ConversionFormat.BASE64:
        // HTML -> BASE64
        const htmlBlob = new Blob([content], { type: 'text/html' });
        const htmlBase64 = await this.base64Service.fileToBase64(
          htmlBlob,
          options['base64Options']
        );
        return new Blob([htmlBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from HTML to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA RTF
   */
  private async convertFromRtf(
    content: string,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    // RTF -> HTML prima (parsing base RTF)
    const html = this.rtfService.rtfToHtml(content);

    switch (targetFormat) {
      case ConversionFormat.HTML:
        return new Blob([html], { type: 'text/html' });

      case ConversionFormat.TXT:
        // RTF -> TXT (direct text extraction, no HTML intermediate)
        const text = this.rtfService.rtfToText(content);
        return new Blob([text], { type: 'text/plain' });

      case ConversionFormat.MD:
        // RTF -> HTML -> MD
        const turndown = await this.getTurndownService();
        const markdown = turndown.turndown(html);
        return new Blob([markdown], { type: 'text/markdown' });

      case ConversionFormat.PDF:
        // RTF -> HTML -> PDF
        const pdfBytes = await this.pdfService.createPdfFromHtml(html);
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.BASE64:
        // RTF -> BASE64
        const rtfBlob = new Blob([content], { type: 'application/rtf' });
        const rtfBase64 = await this.base64Service.fileToBase64(rtfBlob, options['base64Options']);
        return new Blob([rtfBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from RTF to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA formati spreadsheet (CSV, XLSX, JSON)
   */
  private async convertFromSpreadsheet(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    if (sourceFormat === ConversionFormat.JSON && this.isStructuredTabularTarget(targetFormat)) {
      const pipeline = await this.buildStructuredSourcePipeline(file, sourceFormat, options);
      return this.convertTabularRows(
        this.getRequiredTabularRows(pipeline.tabular).rows,
        targetFormat,
        options
      );
    }

    if (sourceFormat === ConversionFormat.CSV) {
      return this.convertSpreadsheetRows(
        await this.csvService.csvToJson(file),
        targetFormat,
        options
      );
    }

    if (sourceFormat === ConversionFormat.JSON) {
      const text = await this.readFileAsText(file);
      return this.convertSpreadsheetRows(JSON.parse(text), targetFormat, options);
    }

    return this.convertBinarySpreadsheet(file, targetFormat, options);
  }

  private async convertSpreadsheetRows(
    rows: Record<string, unknown>[],
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    switch (targetFormat) {
      case ConversionFormat.CSV:
        return new Blob([this.csvService.jsonToCsv(this.protectRowsFromFormulaInjection(rows))], {
          type: 'text/csv',
        });

      case ConversionFormat.JSON:
        return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });

      case ConversionFormat.YAML:
        const yamlString = await this.yamlService.jsonToYaml(
          JSON.stringify(rows, null, 2),
          options['yamlOptions']
        );
        return new Blob([yamlString], { type: 'application/x-yaml' });

      case ConversionFormat.XML:
        const xmlString = await this.xmlService.jsonToXml(
          JSON.stringify(rows, null, 2),
          options['xmlOptions']
        );
        return new Blob([xmlString], { type: 'application/xml' });

      case ConversionFormat.XLSX:
        const xlsxBuffer = await this.spreadsheetWorkerService.convertRowsToXlsx(
          this.protectRowsFromFormulaInjection(rows)
        );
        return new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });

      case ConversionFormat.HTML:
        let htmlTable = await this.spreadsheetWorkerService.convertRowsToHtml(rows);
        htmlTable = await this.processHtmlOptions(htmlTable, options);
        return new Blob([htmlTable], { type: 'text/html' });

      case ConversionFormat.MD:
        const mdTable = this.rowsToMarkdownTable(rows);
        return new Blob([mdTable], { type: 'text/markdown' });

      case ConversionFormat.PDF:
        let htmlForPdf = await this.spreadsheetWorkerService.convertRowsToHtml(rows);
        htmlForPdf = await this.processHtmlOptions(htmlForPdf, options);
        const pdfFromRows = await this.pdfService.createPdfFromHtml(htmlForPdf);
        return new Blob([pdfFromRows as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.TXT:
        const txtData = await this.spreadsheetWorkerService.convertRowsToTxt(rows);
        return new Blob([txtData], { type: 'text/plain' });

      case ConversionFormat.BASE64:
        const xlsxBuf = await this.spreadsheetWorkerService.convertRowsToXlsx(rows);
        const xlsxBlob = new Blob([xlsxBuf], { type: this.getMimeType(ConversionFormat.XLSX) });
        const xlsxBase64 = await this.base64Service.fileToBase64(
          xlsxBlob,
          options['base64Options']
        );
        return new Blob([xlsxBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion to ${targetFormat} not supported from spreadsheet rows`);
    }
  }

  private async convertBinarySpreadsheet(
    file: File,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const arrayBuffer = await this.readFileAsArrayBuffer(file);

    switch (targetFormat) {
      case ConversionFormat.CSV: {
        const rows = await this.spreadsheetWorkerService.readWorkbookAsJson(arrayBuffer);
        return new Blob([this.csvService.jsonToCsv(this.protectRowsFromFormulaInjection(rows))], {
          type: 'text/csv',
        });
      }

      case ConversionFormat.JSON: {
        const rows = await this.spreadsheetWorkerService.readWorkbookAsJson(arrayBuffer);
        return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      }

      case ConversionFormat.YAML: {
        const rows = await this.spreadsheetWorkerService.readWorkbookAsJson(arrayBuffer);
        const yamlString = await this.yamlService.jsonToYaml(
          JSON.stringify(rows, null, 2),
          options['yamlOptions']
        );
        return new Blob([yamlString], { type: 'application/x-yaml' });
      }

      case ConversionFormat.XML: {
        const rows = await this.spreadsheetWorkerService.readWorkbookAsJson(arrayBuffer);
        const xmlString = await this.xmlService.jsonToXml(
          JSON.stringify(rows, null, 2),
          options['xmlOptions']
        );
        return new Blob([xmlString], { type: 'application/xml' });
      }

      case ConversionFormat.XLSX: {
        const xlsxBuffer = await this.spreadsheetWorkerService.normalizeWorkbookToXlsx(arrayBuffer);
        return new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });
      }

      case ConversionFormat.HTML: {
        let htmlTable = await this.spreadsheetWorkerService.readWorkbookAsHtml(arrayBuffer);
        htmlTable = await this.processHtmlOptions(htmlTable, options);
        return new Blob([htmlTable], { type: 'text/html' });
      }

      case ConversionFormat.MD: {
        const mdRows = await this.spreadsheetWorkerService.readWorkbookAsJson(arrayBuffer);
        const mdTable = this.rowsToMarkdownTable(mdRows);
        return new Blob([mdTable], { type: 'text/markdown' });
      }

      case ConversionFormat.PDF: {
        let htmlForPdf = await this.spreadsheetWorkerService.readWorkbookAsHtml(arrayBuffer);
        htmlForPdf = await this.processHtmlOptions(htmlForPdf, options);
        const pdfFromXlsx = await this.pdfService.createPdfFromHtml(htmlForPdf);
        return new Blob([pdfFromXlsx as BlobPart], { type: 'application/pdf' });
      }

      case ConversionFormat.TXT: {
        const txtData = await this.spreadsheetWorkerService.readWorkbookAsTxt(arrayBuffer);
        return new Blob([txtData], { type: 'text/plain' });
      }

      case ConversionFormat.BASE64: {
        const xlsxBuffer = await this.spreadsheetWorkerService.normalizeWorkbookToXlsx(arrayBuffer);
        const xlsxBlob = new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });
        const xlsxBase64 = await this.base64Service.fileToBase64(
          xlsxBlob,
          options['base64Options']
        );
        return new Blob([xlsxBase64], { type: 'text/plain' });
      }

      default:
        throw new Error(`Conversion to ${targetFormat} not supported from spreadsheet files`);
    }
  }

  /**
   * Conversioni DA PDF
   */
  private async convertFromPdf(
    file: File,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    switch (targetFormat) {
      case ConversionFormat.TXT:
      case ConversionFormat.MD:
      case ConversionFormat.HTML:
        // PDF -> TXT (extract text)
        const text = await this.pdfService.extractTextFromPdf(file);
        if (targetFormat === ConversionFormat.TXT) {
          return new Blob([text], { type: 'text/plain' });
        } else if (targetFormat === ConversionFormat.MD) {
          return new Blob([text], { type: 'text/markdown' });
        } else {
          return new Blob([`<pre>${this.escapeHtml(text)}</pre>`], { type: 'text/html' });
        }

      case ConversionFormat.PNG:
      case ConversionFormat.JPEG:
        // PDF -> Image (first page only)
        const imageBlob = await this.pdfService.convertPdfPageToImage(
          file,
          1,
          options.scale || 2.0
        );
        if (targetFormat === ConversionFormat.JPEG) {
          // Convert PNG to JPEG
          const tempFile = new File([imageBlob], 'temp.png', { type: 'image/png' });
          return this.imageService.convertImage(
            tempFile,
            ConversionFormat.JPEG,
            options.quality || 85
          );
        }
        return imageBlob;

      case ConversionFormat.BASE64:
        // PDF -> BASE64
        const pdfBase64 = await this.base64Service.fileToBase64(file, options['base64Options']);
        return new Blob([pdfBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from PDF to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA EPUB
   */
  private async convertFromEpub(
    file: File,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    // Usa metadata EPUB per titoli output migliori (passati da convert())
    const epubMetadata: EpubMetadata | undefined = options['_epubMetadata'];
    const epubTitle = epubMetadata?.title || 'Document';

    switch (targetFormat) {
      case ConversionFormat.TXT:
        // EPUB -> TXT
        const text = await this.epubService.extractTextFromEpub(file);
        return new Blob([text], { type: 'text/plain' });

      case ConversionFormat.HTML:
        // EPUB -> HTML — usa il titolo EPUB nel <title>
        const html = await this.epubService.extractHtmlFromEpub(file);
        let fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${this.escapeHtml(epubTitle)}</title></head>
<body>${html}</body>
</html>`;
        fullHtml = await this.processHtmlOptions(fullHtml, options);
        return new Blob([fullHtml], { type: 'text/html' });

      case ConversionFormat.MD:
        // EPUB -> HTML -> MD
        const htmlContent = this.sanitizeHtmlForUntrustedInput(
          await this.epubService.extractHtmlFromEpub(file)
        );
        const turndown = await this.getTurndownService();
        const markdown = turndown.turndown(htmlContent);
        return new Blob([markdown], { type: 'text/markdown' });

      case ConversionFormat.PDF:
        // EPUB -> HTML -> PDF
        const htmlForPdf = this.sanitizeHtmlForUntrustedInput(
          await this.epubService.extractHtmlFromEpub(file)
        );
        const pdfBytes = await this.pdfService.createPdfFromHtml(htmlForPdf);
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.RTF:
        // EPUB -> HTML -> RTF
        const htmlForRtf = this.sanitizeHtmlForUntrustedInput(
          await this.epubService.extractHtmlFromEpub(file)
        );
        const rtfContent = await this.rtfService.htmlToRtf(htmlForRtf, options['rtfOptions']);
        return new Blob([rtfContent], { type: 'application/rtf' });

      case ConversionFormat.BASE64:
        // EPUB -> BASE64
        const epubBase64 = await this.base64Service.fileToBase64(file, options['base64Options']);
        return new Blob([epubBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from EPUB to ${targetFormat} not supported`);
    }
  }

  /**
   * Conversioni DA formati dati (YAML, XML)
   */
  private async convertFromDataFormat(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const content = await this.readFileAsText(file);

    if (sourceFormat === ConversionFormat.YAML) {
      // YAML -> JSON
      if (targetFormat === ConversionFormat.JSON) {
        const jsonData = await this.yamlService.yamlToJson(content, options['yamlOptions']);
        const jsonString = JSON.stringify(jsonData, null, 2);
        return new Blob([jsonString], { type: 'application/json' });
      }
      // YAML -> BASE64
      if (targetFormat === ConversionFormat.BASE64) {
        const yamlBlob = new Blob([content], { type: 'application/x-yaml' });
        const yamlBase64 = await this.base64Service.fileToBase64(
          yamlBlob,
          options['base64Options']
        );
        return new Blob([yamlBase64], { type: 'text/plain' });
      }
      throw new Error(`Conversion from YAML to ${targetFormat} not supported`);
    }

    if (sourceFormat === ConversionFormat.XML) {
      if (this.isStructuredTabularTarget(targetFormat)) {
        const pipeline = await this.buildStructuredSourcePipeline(file, sourceFormat, options);
        return this.convertTabularRows(
          this.getRequiredTabularRows(pipeline.tabular).rows,
          targetFormat,
          options
        );
      }

      // XML -> JSON
      if (targetFormat === ConversionFormat.JSON) {
        const jsonData = await this.xmlService.xmlToJson(content, options['xmlOptions']);
        const jsonString = JSON.stringify(jsonData, null, 2);
        return new Blob([jsonString], { type: 'application/json' });
      }
      // XML -> YAML
      if (targetFormat === ConversionFormat.YAML) {
        const jsonData = await this.xmlService.xmlToJson(content, options['xmlOptions']);
        const jsonString = JSON.stringify(jsonData, null, 2);
        const yamlString = await this.yamlService.jsonToYaml(jsonString, options['yamlOptions']);
        return new Blob([yamlString], { type: 'application/x-yaml' });
      }
      // XML -> BASE64
      if (targetFormat === ConversionFormat.BASE64) {
        const xmlBlob = new Blob([content], { type: 'application/xml' });
        const xmlBase64 = await this.base64Service.fileToBase64(xmlBlob, options['base64Options']);
        return new Blob([xmlBase64], { type: 'text/plain' });
      }
      throw new Error(`Conversion from XML to ${targetFormat} not supported`);
    }

    throw new Error(`Unsupported data format: ${sourceFormat}`);
  }

  /**
   * Conversioni DA Base64
   */
  private async convertFromBase64(
    file: File,
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const content = await this.readFileAsText(file);

    // Base64 può essere decodificato in qualsiasi formato binario
    // Il targetFormat determina il mime type del blob risultante
    const result = await this.base64Service.base64ToFile(content, options['base64Options']);
    const blob = result.data instanceof Blob ? result.data : new Blob([result.data]);

    // Se il target è un formato specifico, convertiamo
    if (targetFormat !== ConversionFormat.TXT) {
      // Crea un file temporaneo dal blob decodificato
      const decodedFile = new File([blob], `decoded.${targetFormat}`, { type: blob.type });

      // Rileva il formato del file decodificato
      const detectedFormat = this.detectFormat(decodedFile);

      if (detectedFormat && detectedFormat !== targetFormat) {
        // Converti al formato target
        const convResult = await this.convert(decodedFile, detectedFormat, targetFormat, options);
        if (convResult.success && convResult.blob) {
          return convResult.blob;
        }
      }
    }

    return blob;
  }

  /**
   * Verifica se una conversione è supportata
   */
  private isConversionSupported(
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat
  ): boolean {
    if (sourceFormat === targetFormat) return false;

    return this.supportedConversions[sourceFormat]?.some(
      (conversion) => conversion.target === targetFormat
    );
  }

  /**
   * Helper methods
   */
  private isImageFormat(format: ConversionFormat): boolean {
    return [
      ConversionFormat.PNG,
      ConversionFormat.JPEG,
      ConversionFormat.JPG,
      ConversionFormat.WEBP,
    ].includes(format);
  }

  private isDocumentFormat(format: ConversionFormat): boolean {
    return [
      ConversionFormat.TXT,
      ConversionFormat.MD,
      ConversionFormat.HTML,
      ConversionFormat.RTF,
    ].includes(format);
  }

  private isDataFormat(format: ConversionFormat): boolean {
    return [ConversionFormat.YAML, ConversionFormat.XML].includes(format);
  }

  private isSpreadsheetFormat(format: ConversionFormat): boolean {
    return [
      ConversionFormat.CSV,
      ConversionFormat.JSON,
      ConversionFormat.XLSX,
      ConversionFormat.ODS,
    ].includes(format);
  }

  private getMimeType(format: ConversionFormat): string {
    const formatInfo = SUPPORTED_FORMATS.find((f) => f.format === format);
    return formatInfo?.mimeType || 'application/octet-stream';
  }

  private generateFileName(originalName: string, targetFormat: ConversionFormat): string {
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    return `${nameWithoutExt}.${targetFormat}`;
  }

  /**
   * Genera nome file da metadata EPUB (titolo + autore opzionale).
   * Sanitizza il titolo per l'uso come nome file.
   * Es. "Il Grande Gatsby" di "F. Scott Fitzgerald" → "Il_Grande_Gatsby_-_F._Scott_Fitzgerald.pdf"
   */
  private generateFileNameFromEpubMetadata(
    metadata: EpubMetadata,
    targetFormat: ConversionFormat
  ): string {
    const title = metadata.title && metadata.title !== 'Unknown' ? metadata.title : null;

    if (!title) {
      return `document.${targetFormat}`;
    }

    let baseName = this.sanitizeFileNameFromTitle(title);

    // Aggiungi autore se disponibile
    if (metadata.author) {
      const sanitizedAuthor = this.sanitizeFileNameFromTitle(metadata.author);
      if (sanitizedAuthor) {
        baseName = `${baseName}_-_${sanitizedAuthor}`;
      }
    }

    // Limita la lunghezza a 100 caratteri (senza estensione)
    if (baseName.length > 100) {
      baseName = baseName.substring(0, 100);
    }

    return `${baseName}.${targetFormat}`;
  }

  /**
   * Sanitizza un titolo per l'uso come nome file.
   * Rimuove caratteri pericolosi e sostituisce spazi con underscore.
   */
  private sanitizeFileNameFromTitle(title: string): string {
    return title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Rimuovi caratteri illegali per filesystem
      .replace(/\s+/g, '_') // Spazi → underscore
      .replace(/_+/g, '_') // Underscore multipli → singolo
      .replace(/^_|_$/g, ''); // Rimuovi underscore iniziali/finali
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as text'));
      reader.onabort = () => reject(new Error('File read aborted'));
      reader.readAsText(file);
    });
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error ?? new Error('Failed to read file as ArrayBuffer'));
      reader.onabort = () => reject(new Error('File read aborted'));
      reader.readAsArrayBuffer(file);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Applica opzioni di processamento HTML (sanitize, inline CSS, minify)
   * @param html HTML da processare
   * @param options Opzioni di conversione
   * @returns HTML processato
   */
  private async processHtmlOptions(html: string, options: ConversionOptions): Promise<string> {
    let processed = html;
    const hadDoctype = /<!doctype\s+html/i.test(html);

    // Sanitize di default per i flussi che generano HTML riutilizzabile.
    if (options.htmlSanitize !== false) {
      processed = this.htmlService.sanitize(processed);
      if (hadDoctype && !/<!doctype\s+html/i.test(processed)) {
        processed = `<!DOCTYPE html>\n${processed}`;
      }
    }

    // Inline CSS (per email compatibility)
    if (options.htmlInlineCss === true) {
      processed = this.htmlService.inlineCss(processed);
    }

    // Minify (riduce dimensione)
    if (options.htmlMinify === true) {
      processed = await this.htmlService.minifyHtml(processed);
    }

    return processed;
  }

  /**
   * Ottieni lista dei formati di destinazione disponibili per un formato sorgente
   */
  getAvailableTargetFormats(sourceFormat: ConversionFormat): ConversionFormat[] {
    return this.getAvailableTargetSupports(sourceFormat).map((conversion) => conversion.target);
  }

  getAvailableTargetSupports(sourceFormat: ConversionFormat): ConversionSupport[] {
    return this.supportedConversions[sourceFormat] ?? [];
  }

  getConversionSupport(
    sourceFormat: ConversionFormat | null,
    targetFormat: ConversionFormat | null
  ): ConversionSupport | null {
    if (!sourceFormat || !targetFormat || sourceFormat === targetFormat) {
      return null;
    }

    return (
      this.supportedConversions[sourceFormat]?.find(
        (conversion) => conversion.target === targetFormat
      ) ?? null
    );
  }

  async validateConversion(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionPreflightResult> {
    const support = this.getConversionSupport(sourceFormat, targetFormat);

    if (!support) {
      return {
        reliability: null,
        blocking: true,
        severity: 'danger',
        messageKey: 'CONVERSION_VALIDATION.UNSUPPORTED',
      };
    }

    const contentSpecificValidation = await this.validateContentSpecificConversion(
      file,
      sourceFormat,
      targetFormat,
      support,
      options
    );

    if (contentSpecificValidation) {
      return contentSpecificValidation;
    }

    switch (support.reliability) {
      case 'lossless':
      case 'structured':
        return {
          reliability: support.reliability,
          blocking: false,
          severity: null,
          messageKey: null,
        };

      case 'text-only':
        return {
          reliability: support.reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.TEXT_ONLY',
        };

      case 'best-effort':
        return {
          reliability: support.reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.BEST_EFFORT',
        };

      case 'table-only':
        return {
          reliability: support.reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.TABLE_ONLY',
        };

      case 'requires-uniform-data':
        return this.validateUniformDataConversion(file, sourceFormat, support.reliability);
    }
  }

  private async validateContentSpecificConversion(
    file: File,
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat,
    support: ConversionSupport,
    options: ConversionOptions
  ): Promise<ConversionPreflightResult | null> {
    if (sourceFormat === ConversionFormat.PDF && this.isPdfTextExtractionTarget(targetFormat)) {
      return this.validatePdfTextExtraction(file, support.reliability);
    }

    if (sourceFormat === ConversionFormat.HTML && this.targetFlattensHtmlTables(targetFormat)) {
      const html = await this.readFileAsText(file);
      if (this.containsHtmlTable(html)) {
        return {
          reliability: support.reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_COMPLEXITY',
        };
      }
    }

    if (sourceFormat === ConversionFormat.HTML && this.isHtmlTableExportTarget(targetFormat)) {
      return this.validateHtmlTableExport(file, support.reliability);
    }

    if (
      this.isStructuredSourceWithControlledTabularPreflight(sourceFormat) &&
      this.isStructuredTabularTarget(targetFormat)
    ) {
      return this.validateStructuredTabularConversion(
        file,
        sourceFormat,
        support.reliability,
        options
      );
    }

    if (sourceFormat === ConversionFormat.TXT && targetFormat === ConversionFormat.CSV) {
      return this.validateTxtCsvConversion(file, support.reliability);
    }

    if (this.isFragileMultiStepConversion(sourceFormat, targetFormat)) {
      return {
        reliability: support.reliability,
        blocking: false,
        severity: 'warning',
        messageKey: 'CONVERSION_VALIDATION.MULTI_STEP_REVIEW',
      };
    }

    return null;
  }

  /**
   * Rileva automaticamente il formato di un file dalla sua estensione
   */
  detectFormat(file: File): ConversionFormat | null {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    const format = SUPPORTED_FORMATS.find((f) =>
      f.extensions.some((ext) => ext.toLowerCase() === `.${extension}`)
    );

    return format?.format || null;
  }

  /**
   * Prova a rilevare il formato reale del contenuto per file testuali comuni.
   * Usato per ridurre mismatch tra estensione e contenuto prima della conversione.
   */
  async detectFormatFromContent(file: File): Promise<ConversionFormat | null> {
    const extensionFormat = this.detectFormat(file);

    if (!this.isInspectableTextFormat(file, extensionFormat)) {
      return extensionFormat;
    }

    const text = await this.readFileAsText(file);
    const trimmed = text.trim();

    if (!trimmed) {
      return extensionFormat ?? ConversionFormat.TXT;
    }

    if (this.isJsonContent(trimmed)) {
      return ConversionFormat.JSON;
    }

    if (this.isHtmlContent(trimmed)) {
      return ConversionFormat.HTML;
    }

    if (this.isXmlContent(trimmed)) {
      return ConversionFormat.XML;
    }

    if (this.isCsvContent(trimmed)) {
      return ConversionFormat.CSV;
    }

    if (this.isPlainTextContent(trimmed)) {
      return ConversionFormat.TXT;
    }

    return extensionFormat;
  }

  private isInspectableTextFormat(file: File, extensionFormat: ConversionFormat | null): boolean {
    const inspectableFormats = new Set<ConversionFormat>([
      ConversionFormat.TXT,
      ConversionFormat.JSON,
      ConversionFormat.XML,
      ConversionFormat.HTML,
      ConversionFormat.CSV,
    ]);

    if (extensionFormat && inspectableFormats.has(extensionFormat)) {
      return true;
    }

    // If extension identifies a non-ambiguous format (MD, RTF, YAML, etc.), trust it
    if (extensionFormat) {
      return false;
    }

    return file.type.startsWith('text/') || file.type === 'application/json';
  }

  private isJsonContent(text: string): boolean {
    if (!['{', '['].includes(text[0])) {
      return false;
    }

    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  private isHtmlContent(text: string): boolean {
    const lowerText = text.toLowerCase();
    const htmlMarkers = [
      '<!doctype html',
      '<html',
      '<head',
      '<body',
      '<div',
      '<section',
      '<article',
      '<main',
      '<table',
      '<p',
      '<span',
      '<h1',
      '<h2',
    ];

    return htmlMarkers.some((marker) => lowerText.includes(marker));
  }

  private isXmlContent(text: string): boolean {
    if (!text.startsWith('<')) {
      return false;
    }

    if (this.isHtmlContent(text)) {
      return false;
    }

    const parsed = new DOMParser().parseFromString(text, 'application/xml');
    return !parsed.querySelector('parsererror');
  }

  private isCsvContent(text: string): boolean {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return false;
    }

    const delimiters = [',', ';', '\t'];

    return delimiters.some((delimiter) => {
      const counts = lines.slice(0, 5).map((line) => this.countOccurrences(line, delimiter));
      const firstCount = counts[0];

      return firstCount > 0 && counts.every((count) => count === firstCount);
    });
  }

  private isPlainTextContent(text: string): boolean {
    return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text);
  }

  private countOccurrences(text: string, token: string): number {
    return text.split(token).length - 1;
  }

  private isPdfTextExtractionTarget(targetFormat: ConversionFormat): boolean {
    return [ConversionFormat.TXT, ConversionFormat.MD, ConversionFormat.HTML].includes(
      targetFormat
    );
  }

  private async validatePdfTextExtraction(
    file: File,
    reliability: ConversionSupport['reliability']
  ): Promise<ConversionPreflightResult | null> {
    try {
      const extractedText = await this.pdfService.extractTextFromPdf(file, false);
      const normalizedText = extractedText.replace(/\s+/g, ' ').trim();

      if (!normalizedText) {
        return {
          reliability,
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.PDF_TEXT_REQUIRED',
        };
      }

      if (normalizedText.length < 20) {
        return {
          reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.PDF_TEXT_LIMITED',
        };
      }

      return null;
    } catch {
      return {
        reliability,
        blocking: true,
        severity: 'danger',
        messageKey: 'CONVERSION_VALIDATION.PDF_TEXT_REQUIRED',
      };
    }
  }

  private async validateTxtCsvConversion(
    file: File,
    reliability: ConversionSupport['reliability']
  ): Promise<ConversionPreflightResult | null> {
    const text = await this.readFileAsText(file);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return {
        reliability,
        blocking: true,
        severity: 'danger',
        messageKey: 'CONVERSION_VALIDATION.TXT_NO_TABULAR_STRUCTURE',
      };
    }

    const delimiters = [',', ';', '\t', '|'];
    const hasConsistentDelimiter = delimiters.some((d) => {
      const counts = lines.slice(0, 10).map((line) => this.countOccurrences(line, d));
      return counts[0] > 0 && counts.every((c) => c === counts[0]);
    });

    if (!hasConsistentDelimiter) {
      return {
        reliability,
        blocking: false,
        severity: 'warning',
        messageKey: 'CONVERSION_VALIDATION.TXT_DELIMITER_UNCERTAIN',
      };
    }

    return null;
  }

  private containsHtmlTable(html: string): boolean {
    return /<table\b/i.test(html) && /<(thead|tbody|tr|th|td)\b/i.test(html);
  }

  private targetFlattensHtmlTables(targetFormat: ConversionFormat): boolean {
    return [ConversionFormat.TXT, ConversionFormat.MD, ConversionFormat.PDF].includes(targetFormat);
  }

  private isHtmlTableExportTarget(targetFormat: ConversionFormat): boolean {
    return [ConversionFormat.CSV, ConversionFormat.XLSX].includes(targetFormat);
  }

  private isStructuredTabularTarget(targetFormat: ConversionFormat): boolean {
    return [ConversionFormat.CSV, ConversionFormat.XLSX, ConversionFormat.HTML].includes(
      targetFormat
    );
  }

  private isStructuredSourceWithControlledTabularPreflight(
    sourceFormat: ConversionFormat
  ): boolean {
    return [ConversionFormat.JSON, ConversionFormat.XML].includes(sourceFormat);
  }

  private isFragileMultiStepConversion(
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat
  ): boolean {
    const fragileConversions = new Set([
      `${ConversionFormat.MD}->${ConversionFormat.PDF}`,
      `${ConversionFormat.RTF}->${ConversionFormat.MD}`,
      `${ConversionFormat.RTF}->${ConversionFormat.PDF}`,
      `${ConversionFormat.EPUB}->${ConversionFormat.MD}`,
      `${ConversionFormat.EPUB}->${ConversionFormat.PDF}`,
      `${ConversionFormat.EPUB}->${ConversionFormat.RTF}`,
      `${ConversionFormat.CSV}->${ConversionFormat.PDF}`,
      `${ConversionFormat.XLSX}->${ConversionFormat.PDF}`,
    ]);

    return fragileConversions.has(`${sourceFormat}->${targetFormat}`);
  }

  private async validateUniformDataConversion(
    file: File,
    sourceFormat: ConversionFormat,
    reliability: ConversionSupport['reliability']
  ): Promise<ConversionPreflightResult> {
    if (sourceFormat !== ConversionFormat.JSON) {
      return {
        reliability,
        blocking: false,
        severity: 'warning',
        messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
      };
    }

    try {
      const text = await this.readFileAsText(file);
      const parsed = JSON.parse(text);

      if (this.isPlainObject(parsed)) {
        return {
          reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
        };
      }

      if (!Array.isArray(parsed) || parsed.some((item) => !this.isPlainObject(item))) {
        return {
          reliability,
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.JSON_ARRAY_OF_OBJECTS_REQUIRED',
        };
      }

      if (parsed.length <= 1) {
        return {
          reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
        };
      }

      const expectedKeys = this.getNormalizedObjectKeys(parsed[0]);
      const hasUniformShape = parsed.every(
        (item) => this.getNormalizedObjectKeys(item).join('|') === expectedKeys.join('|')
      );

      return hasUniformShape
        ? {
            reliability,
            blocking: false,
            severity: 'warning',
            messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
          }
        : {
            reliability,
            blocking: true,
            severity: 'danger',
            messageKey: 'CONVERSION_VALIDATION.JSON_UNIFORM_KEYS_REQUIRED',
          };
    } catch {
      return {
        reliability,
        blocking: true,
        severity: 'danger',
        messageKey: 'CONVERSION_VALIDATION.INVALID_JSON',
      };
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getNormalizedObjectKeys(value: Record<string, unknown>): string[] {
    return Object.keys(value).sort();
  }

  private async validateHtmlTableExport(
    file: File,
    reliability: ConversionSupport['reliability']
  ): Promise<ConversionPreflightResult | null> {
    const html = await this.readFileAsText(file);
    const table = this.extractHtmlTableRows(html);

    if (!table || table.rows.length === 0) {
      return {
        reliability,
        blocking: true,
        severity: 'danger',
        messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_REQUIRED',
      };
    }

    if (table.hasMergedCells) {
      return {
        reliability,
        blocking: false,
        severity: 'warning',
        messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_MERGED_CELLS',
      };
    }

    if (table.hasNestedTables) {
      return {
        reliability,
        blocking: false,
        severity: 'warning',
        messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_NESTED',
      };
    }

    return null;
  }

  private async validateStructuredTabularConversion(
    file: File,
    sourceFormat: ConversionFormat,
    reliability: ConversionSupport['reliability'],
    options: ConversionOptions
  ): Promise<ConversionPreflightResult | null> {
    if (sourceFormat === ConversionFormat.JSON) {
      const uniformValidation = await this.validateUniformDataConversion(
        file,
        sourceFormat,
        reliability
      );

      if (uniformValidation.blocking) {
        return uniformValidation;
      }
    }

    try {
      const pipeline = await this.buildStructuredSourcePipeline(
        file,
        sourceFormat as ConversionFormat.JSON | ConversionFormat.XML,
        options
      );
      const normalization = pipeline.tabular;

      if (!normalization) {
        return {
          reliability,
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_TABULAR_DATA_REQUIRED',
        };
      }

      if (normalization.rows.length === 0) {
        return {
          reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
        };
      }

      if (normalization.normalized) {
        return {
          reliability,
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        };
      }

      return null;
    } catch {
      return {
        reliability,
        blocking: true,
        severity: 'danger',
        messageKey:
          sourceFormat === ConversionFormat.XML
            ? 'CONVERSION_VALIDATION.INVALID_XML'
            : 'CONVERSION_VALIDATION.INVALID_JSON',
      };
    }
  }

  private async getTabularRowsFromStructuredSource(
    file: File,
    sourceFormat: ConversionFormat.JSON | ConversionFormat.XML,
    options: ConversionOptions = {}
  ): Promise<TabularNormalizationResult> {
    const pipeline = await this.buildStructuredSourcePipeline(file, sourceFormat, options);
    return this.getRequiredTabularRows(pipeline.tabular);
  }

  async getStructuredDataExportProfile(
    file: File,
    sourceFormat: ConversionFormat
  ): Promise<StructuredDataExportProfile | null> {
    if (!this.isStructuredSourceWithControlledTabularPreflight(sourceFormat)) {
      return null;
    }

    try {
      const pipeline = await this.buildStructuredSourcePipeline(
        file,
        sourceFormat as ConversionFormat.JSON | ConversionFormat.XML
      );
      return {
        collectionPaths: pipeline.collectionPaths,
        defaultOptions: { ...this.defaultStructuredDataOptions },
      };
    } catch {
      return {
        collectionPaths: [],
        defaultOptions: { ...this.defaultStructuredDataOptions },
      };
    }
  }

  private async buildStructuredSourcePipeline(
    file: File,
    sourceFormat: ConversionFormat.JSON | ConversionFormat.XML,
    options: ConversionOptions = {}
  ): Promise<StructuredSourcePipelineResult> {
    const content = await this.readFileAsText(file);
    const parsed = await this.parseStructuredSourceContent(content, sourceFormat);

    return {
      parsed,
      collectionPaths: this.findNestedObjectCollectionPaths(parsed),
      tabular: this.normalizeTabularData(parsed, options),
    };
  }

  private async parseStructuredSourceContent(
    content: string,
    sourceFormat: ConversionFormat.JSON | ConversionFormat.XML
  ): Promise<unknown> {
    return sourceFormat === ConversionFormat.XML
      ? this.xmlService.xmlToJson(content)
      : JSON.parse(content);
  }

  private getRequiredTabularRows(
    normalization: TabularNormalizationResult | null
  ): TabularNormalizationResult {
    if (!normalization) {
      throw new Error('STRUCTURED_TABULAR_DATA_REQUIRED');
    }

    return normalization;
  }

  private normalizeTabularData(
    data: unknown,
    options: ConversionOptions = {}
  ): TabularNormalizationResult | null {
    const normalizationOptions = this.resolveStructuredDataOptions(options);

    if (Array.isArray(data)) {
      return this.normalizeTabularCollection(data, false, normalizationOptions);
    }

    if (this.isPlainObject(data)) {
      const extractedCollection = this.findNestedObjectCollection(data, normalizationOptions);
      if (extractedCollection) {
        return this.normalizeTabularCollection(extractedCollection, true, normalizationOptions);
      }

      const flattenedRow = this.flattenTabularRecord(data, '', normalizationOptions);
      if (!flattenedRow) {
        return null;
      }

      return {
        rows: [flattenedRow.row],
        normalized: flattenedRow.flattened,
      };
    }

    return null;
  }

  private normalizeTabularCollection(
    collection: unknown[],
    extractedFromNestedPath: boolean,
    options: StructuredDataNormalizationOptions
  ): TabularNormalizationResult | null {
    if (collection.some((item) => !this.isPlainObject(item))) {
      return null;
    }

    const flattenedRows = collection.map((item) =>
      this.flattenTabularRecord(item as Record<string, unknown>, '', options)
    );
    if (flattenedRows.some((row) => !row)) {
      return null;
    }

    const rows = flattenedRows.map((row) => row!.row);
    const hasUniformShape =
      rows.length <= 1 ||
      rows.every(
        (row) =>
          this.getNormalizedObjectKeys(row).join('|') ===
          this.getNormalizedObjectKeys(rows[0]).join('|')
      );

    if (!hasUniformShape) {
      return null;
    }

    return {
      rows,
      normalized: extractedFromNestedPath || flattenedRows.some((row) => row?.flattened === true),
    };
  }

  private flattenTabularRecord(
    value: Record<string, unknown>,
    prefix: string = '',
    options: StructuredDataNormalizationOptions
  ): { row: Record<string, unknown>; flattened: boolean } | null {
    const row: Record<string, unknown> = {};
    let flattened = false;

    for (const [key, nestedValue] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      const normalizedKey = this.normalizeTabularColumnKey(nextKey, options.columnNaming);

      if (nestedValue === null || ['string', 'number', 'boolean'].includes(typeof nestedValue)) {
        if (normalizedKey in row) {
          return null;
        }
        row[normalizedKey] = nestedValue;
        continue;
      }

      if (Array.isArray(nestedValue)) {
        if (
          nestedValue.every(
            (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item)
          )
        ) {
          if (normalizedKey in row) {
            return null;
          }
          row[normalizedKey] =
            options.primitiveArrayStrategy === 'json'
              ? JSON.stringify(nestedValue)
              : nestedValue.join(', ');
          flattened = true;
          continue;
        }

        return null;
      }

      if (this.isPlainObject(nestedValue)) {
        const nestedRow = this.flattenTabularRecord(nestedValue, nextKey, options);
        if (!nestedRow) {
          return null;
        }

        Object.assign(row, nestedRow.row);
        flattened = true;
        continue;
      }

      return null;
    }

    return { row, flattened };
  }

  private findNestedObjectCollection(
    data: Record<string, unknown>,
    options: StructuredDataNormalizationOptions
  ): unknown[] | null {
    const selected = this.findNestedObjectCollectionEntry(data, '', options.collectionPath);
    if (options.collectionPath) {
      return selected.matchedPreferredPath ? selected.collection : null;
    }

    return selected.collection;
  }

  private findNestedObjectCollectionEntry(
    data: Record<string, unknown>,
    prefix: string,
    preferredPath: string | null
  ): { collection: unknown[] | null; matchedPreferredPath: boolean } {
    for (const [key, value] of Object.entries(data)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value) && value.every((item) => this.isPlainObject(item))) {
        if (!preferredPath || preferredPath === nextPath) {
          return {
            collection: value,
            matchedPreferredPath: preferredPath === nextPath,
          };
        }
      }

      if (this.isPlainObject(value)) {
        const nested = this.findNestedObjectCollectionEntry(value, nextPath, preferredPath);
        if (nested.collection) {
          return nested;
        }
      }
    }

    return { collection: null, matchedPreferredPath: false };
  }

  private findNestedObjectCollectionPaths(data: unknown, prefix: string = ''): string[] {
    if (!this.isPlainObject(data)) {
      return [];
    }

    const paths: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const nextPath = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value) && value.every((item) => this.isPlainObject(item))) {
        paths.push(nextPath);
      }

      if (this.isPlainObject(value)) {
        paths.push(...this.findNestedObjectCollectionPaths(value, nextPath));
      }
    }

    return paths;
  }

  private resolveStructuredDataOptions(
    options: ConversionOptions
  ): StructuredDataNormalizationOptions {
    return {
      collectionPath: options.structuredData?.collectionPath ?? null,
      primitiveArrayStrategy:
        options.structuredData?.primitiveArrayStrategy ??
        this.defaultStructuredDataOptions.primitiveArrayStrategy,
      columnNaming:
        options.structuredData?.columnNaming ?? this.defaultStructuredDataOptions.columnNaming,
    };
  }

  private normalizeTabularColumnKey(
    key: string,
    strategy: StructuredDataColumnNamingStrategy
  ): string {
    if (strategy === 'snake_case') {
      return key
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    }

    return key;
  }

  private convertTxtToCsv(content: string): Blob {
    const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0) {
      throw new Error('Text file is empty');
    }

    const delimiter = this.csvService.detectDelimiter(content);
    const normalized = lines
      .map((line) =>
        line
          .split(delimiter)
          .map((cell) => this.csvService.quoteValue(cell.trim()))
          .join(',')
      )
      .join('\r\n');

    return new Blob([normalized], { type: 'text/csv' });
  }

  private rowsToMarkdownTable(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    const escapeCell = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    };

    const headerRow = '| ' + headers.map(escapeCell).join(' | ') + ' |';
    const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const dataRows = rows
      .map((row) => '| ' + headers.map((h) => escapeCell(row[h])).join(' | ') + ' |')
      .join('\n');

    return headerRow + '\n' + separatorRow + '\n' + dataRows + '\n';
  }

  private async convertTabularRows(
    rows: Record<string, unknown>[],
    targetFormat: ConversionFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    if (targetFormat === ConversionFormat.CSV) {
      return new Blob([this.csvService.jsonToCsv(this.protectRowsFromFormulaInjection(rows))], {
        type: 'text/csv',
      });
    }

    if (targetFormat === ConversionFormat.XLSX) {
      const xlsxBuffer = await this.spreadsheetWorkerService.convertRowsToXlsx(
        this.protectRowsFromFormulaInjection(rows)
      );
      return new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });
    }

    let htmlTable = await this.spreadsheetWorkerService.convertRowsToHtml(rows);
    htmlTable = await this.processHtmlOptions(htmlTable, options);
    return new Blob([htmlTable], { type: 'text/html' });
  }

  private async convertHtmlTableToTabular(
    content: string,
    targetFormat: ConversionFormat
  ): Promise<Blob> {
    const table = this.extractHtmlTableRows(content);
    if (!table || table.rows.length === 0) {
      throw new Error('HTML does not contain a tabular structure that can be exported');
    }

    return this.convertTabularRows(table.rows, targetFormat, {});
  }

  private extractHtmlTableRows(
    html: string
  ): { rows: Record<string, string>[]; hasMergedCells: boolean; hasNestedTables: boolean } | null {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const table = parsed.querySelector('table');
    if (!table) {
      return null;
    }

    const hasNestedTables = table.querySelector('td table, th table') !== null;

    const thead = table.querySelector(':scope > thead');
    const tbodies = Array.from(table.querySelectorAll(':scope > tbody'));
    const tfoot = table.querySelector(':scope > tfoot');

    const headerRowElements = thead ? this.getDirectTableRows(thead) : [];
    const bodyRowElements =
      tbodies.length > 0
        ? tbodies.flatMap((tbody) => this.getDirectTableRows(tbody))
        : this.getDirectTableRows(table).filter(
            (row) => (!thead || !thead.contains(row)) && (!tfoot || !tfoot.contains(row))
          );

    const allRowElements = [...headerRowElements, ...bodyRowElements];
    if (allRowElements.length === 0) {
      return null;
    }

    const rawRows = this.buildHtmlTableMatrix(allRowElements).filter((cells) =>
      cells.some((cell) => cell.length > 0)
    );

    if (rawRows.length === 0) {
      return null;
    }

    const directCells = this.getDirectTableCells(table);
    const hasMergedCells = directCells.some((cell) => {
      const colSpan = Number(cell.getAttribute('colspan') || '1');
      const rowSpan = Number(cell.getAttribute('rowspan') || '1');
      return colSpan > 1 || rowSpan > 1;
    });

    const hasTheadSection = thead !== null && headerRowElements.length > 0;
    const headerRowCount = headerRowElements.length;
    const firstRowUsesHeaders =
      hasTheadSection || allRowElements[0].querySelectorAll('th').length > 0;
    const headers = this.createTabularHeaders(rawRows[0], firstRowUsesHeaders);
    const skipRows = hasTheadSection ? headerRowCount : firstRowUsesHeaders ? 1 : 0;
    const dataRows = rawRows.slice(skipRows);

    return {
      rows: dataRows.map((cells) =>
        headers.reduce<Record<string, string>>((record, header, index) => {
          record[header] = cells[index] ?? '';
          return record;
        }, {})
      ),
      hasMergedCells,
      hasNestedTables,
    };
  }

  private getDirectTableRows(parent: Element): HTMLTableRowElement[] {
    return Array.from(parent.children).filter(
      (child): child is HTMLTableRowElement => child.tagName.toLowerCase() === 'tr'
    );
  }

  private getDirectTableCells(table: HTMLTableElement): Element[] {
    const rows = [
      ...this.getDirectTableRows(table),
      ...Array.from(
        table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr')
      ),
    ];
    return rows.flatMap((row) =>
      Array.from(row.children).filter(
        (child) => child.tagName.toLowerCase() === 'th' || child.tagName.toLowerCase() === 'td'
      )
    );
  }

  private buildHtmlTableMatrix(rowElements: HTMLTableRowElement[]): string[][] {
    const matrix: string[][] = [];

    rowElements.forEach((row, rowIndex) => {
      matrix[rowIndex] ??= [];
      let columnIndex = 0;

      Array.from(row.children)
        .filter(
          (child) => child.tagName.toLowerCase() === 'th' || child.tagName.toLowerCase() === 'td'
        )
        .forEach((cell) => {
          while (matrix[rowIndex][columnIndex] !== undefined) {
            columnIndex += 1;
          }

          const text = this.extractDirectCellText(cell).replace(/\s+/g, ' ').trim();
          const colSpan = Math.max(1, Number(cell.getAttribute('colspan') || '1'));
          const rowSpan = Math.max(1, Number(cell.getAttribute('rowspan') || '1'));
          const isHeaderCell = cell.tagName.toLowerCase() === 'th';

          for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
            const targetRowIndex = rowIndex + rowOffset;
            matrix[targetRowIndex] ??= [];

            for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
              const targetColumnIndex = columnIndex + colOffset;
              const shouldRepeatHeader = isHeaderCell && rowOffset === 0;
              matrix[targetRowIndex][targetColumnIndex] =
                rowOffset === 0 && colOffset === 0 ? text : shouldRepeatHeader ? text : '';
            }
          }

          columnIndex += colSpan;
        });
    });

    const maxColumns = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    return matrix.map((row) => Array.from({ length: maxColumns }, (_, index) => row[index] ?? ''));
  }

  private extractDirectCellText(cell: Element): string {
    if (cell.querySelector('table')) {
      const clone = cell.cloneNode(true) as Element;
      clone.querySelectorAll('table').forEach((nested) => nested.remove());
      return clone.textContent || '';
    }
    return cell.textContent || '';
  }

  private sanitizeHtmlForUntrustedInput(html: string): string {
    return this.htmlService.sanitize(html);
  }

  private protectRowsFromFormulaInjection(
    rows: Record<string, unknown>[]
  ): Record<string, unknown>[] {
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, this.protectSpreadsheetCellValue(value)])
      )
    );
  }

  private protectSpreadsheetCellValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private createTabularHeaders(firstRow: string[], useFirstRowAsHeaders: boolean): string[] {
    const baseHeaders = useFirstRowAsHeaders
      ? firstRow.map((header, index) => header || `column_${index + 1}`)
      : firstRow.map((_, index) => `column_${index + 1}`);

    return this.ensureUniqueHeaders(baseHeaders);
  }

  private ensureUniqueHeaders(headers: string[]): string[] {
    const occurrences = new Map<string, number>();

    return headers.map((header) => {
      const count = occurrences.get(header) ?? 0;
      occurrences.set(header, count + 1);
      return count === 0 ? header : `${header}_${count + 1}`;
    });
  }
}
