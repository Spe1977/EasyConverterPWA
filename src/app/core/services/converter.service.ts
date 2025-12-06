import { Injectable, inject } from '@angular/core';
import { ConversionFormat, SUPPORTED_FORMATS } from '@core/models/conversion-format';
import { ConversionResult, ConversionOptions } from '@core/models/conversion-result';
import { PdfService } from './pdf.service';
import { ImageService } from './image.service';
import { EpubService } from './epub.service';
import { CsvService } from './csv.service';
import { HtmlService } from './html.service';
import { RtfService } from './rtf.service';
import { YamlService } from './yaml.service';
import { XmlService } from './xml.service';
import { Base64Service } from './base64.service';

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
  private pdfService = inject(PdfService);
  private imageService = inject(ImageService);
  private epubService = inject(EpubService);
  private csvService = inject(CsvService);
  private htmlService = inject(HtmlService);
  private rtfService = inject(RtfService);
  private yamlService = inject(YamlService);
  private xmlService = inject(XmlService);
  private base64Service = inject(Base64Service);

  // Lazy-loaded libraries (cached after first load)
  private turndownServiceInstance?: any;
  private xlsxModule?: typeof import('xlsx');
  private markedModule?: typeof import('marked');

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

      let blob: Blob;
      const fileName = this.generateFileName(file.name, targetFormat);

      // Route alla funzione di conversione appropriata
      if (this.isImageFormat(sourceFormat)) {
        blob = await this.convertFromImage(file, sourceFormat, targetFormat, options);
      } else if (this.isDocumentFormat(sourceFormat)) {
        blob = await this.convertFromDocument(file, sourceFormat, targetFormat, options);
      } else if (this.isSpreadsheetFormat(sourceFormat)) {
        blob = await this.convertFromSpreadsheet(file, sourceFormat, targetFormat, options);
      } else if (this.isDataFormat(sourceFormat)) {
        blob = await this.convertFromDataFormat(file, sourceFormat, targetFormat, options);
      } else if (sourceFormat === ConversionFormat.BASE64) {
        blob = await this.convertFromBase64(file, targetFormat, options);
      } else if (sourceFormat === ConversionFormat.PDF) {
        blob = await this.convertFromPdf(file, targetFormat, options);
      } else if (sourceFormat === ConversionFormat.EPUB) {
        blob = await this.convertFromEpub(file, targetFormat, options);
      } else {
        throw new Error(`Unsupported source format: ${sourceFormat}`);
      }

      const duration = Date.now() - startTime;

      return {
        blob,
        fileName,
        mimeType: this.getMimeType(targetFormat),
        size: blob.size,
        success: true,
        duration,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Lazy-load helper methods for heavy libraries
   */

  /**
   * Get XLSX module (lazy loaded, ~200 KB)
   * Cached after first load for performance
   */
  private async getXLSX(): Promise<typeof import('xlsx')> {
    if (!this.xlsxModule) {
      this.xlsxModule = await import('xlsx');
    }
    return this.xlsxModule;
  }

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
  private async getTurndownService(): Promise<any> {
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
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return new Blob([text], { type: 'text/plain' });

      case ConversionFormat.MD:
        // HTML -> MD
        const turndown = await this.getTurndownService();
        const markdown = turndown.turndown(content);
        return new Blob([markdown], { type: 'text/markdown' });

      case ConversionFormat.RTF:
        // HTML -> RTF
        const rtfContent = await this.rtfService.htmlToRtf(content, options['rtfOptions']);
        return new Blob([rtfContent], { type: 'application/rtf' });

      case ConversionFormat.PDF:
        // HTML -> PDF
        const pdfBytes = await this.pdfService.createPdfFromHtml(content);
        return new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      case ConversionFormat.EPUB:
        // HTML -> EPUB
        return this.epubService.generateEpubFromHtml(content, 'Document');

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
        // RTF -> HTML -> TXT
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const text = tempDiv.textContent || tempDiv.innerText || '';
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
    const XLSX = await this.getXLSX();
    let workbook: import('xlsx').WorkBook;

    // Carica il file nello workbook
    if (sourceFormat === ConversionFormat.CSV) {
      // Usa CsvService per auto-detection di encoding e delimiter
      const csvData = await this.csvService.csvToJson(file);
      const worksheet = XLSX.utils.json_to_sheet(csvData);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    } else if (sourceFormat === ConversionFormat.JSON) {
      const text = await this.readFileAsText(file);
      const json = JSON.parse(text);
      const worksheet = XLSX.utils.json_to_sheet(json);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    } else {
      // XLSX, ODS - preserva formule e named ranges
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellFormula: true, // Preserva formule Excel
        cellStyles: true, // Preserva stili
        sheetStubs: true, // Mantieni celle vuote
      });
    }

    // Converti al formato target
    switch (targetFormat) {
      case ConversionFormat.CSV:
        // Usa CsvService per generare CSV con quote handling avanzato
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const csvString = this.csvService.jsonToCsv(json);
        return new Blob([csvString], { type: 'text/csv' });

      case ConversionFormat.JSON:
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });

      case ConversionFormat.YAML:
        // Spreadsheet -> JSON -> YAML
        const jsonForYaml = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const jsonString = JSON.stringify(jsonForYaml, null, 2);
        const yamlString = await this.yamlService.jsonToYaml(jsonString, options['yamlOptions']);
        return new Blob([yamlString], { type: 'application/x-yaml' });

      case ConversionFormat.XML:
        // Spreadsheet -> JSON -> XML
        const jsonForXml = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const jsonStr = JSON.stringify(jsonForXml, null, 2);
        const xmlString = await this.xmlService.jsonToXml(jsonStr, options['xmlOptions']);
        return new Blob([xmlString], { type: 'application/xml' });

      case ConversionFormat.XLSX:
        // Preserva formule e named ranges quando esporta XLSX
        const xlsxBuffer = XLSX.write(workbook, {
          type: 'array',
          bookType: 'xlsx',
          bookSST: false, // Disable shared string table per preservare formule
        });
        return new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });

      case ConversionFormat.HTML:
        let htmlTable = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
        htmlTable = await this.processHtmlOptions(htmlTable, options);
        return new Blob([htmlTable], { type: 'text/html' });

      case ConversionFormat.TXT:
        const txtData = XLSX.utils.sheet_to_txt(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([txtData], { type: 'text/plain' });

      case ConversionFormat.BASE64:
        // Spreadsheet -> XLSX -> BASE64
        const xlsxBuf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const xlsxBlob = new Blob([xlsxBuf], { type: this.getMimeType(ConversionFormat.XLSX) });
        const xlsxBase64 = await this.base64Service.fileToBase64(
          xlsxBlob,
          options['base64Options']
        );
        return new Blob([xlsxBase64], { type: 'text/plain' });

      default:
        throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} not supported`);
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
    switch (targetFormat) {
      case ConversionFormat.TXT:
        // EPUB -> TXT
        const text = await this.epubService.extractTextFromEpub(file);
        return new Blob([text], { type: 'text/plain' });

      case ConversionFormat.HTML:
        // EPUB -> HTML
        const html = await this.epubService.extractHtmlFromEpub(file);
        let fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body>${html}</body>
</html>`;
        fullHtml = await this.processHtmlOptions(fullHtml, options);
        return new Blob([fullHtml], { type: 'text/html' });

      case ConversionFormat.MD:
        // EPUB -> HTML -> MD
        const htmlContent = await this.epubService.extractHtmlFromEpub(file);
        const turndown = await this.getTurndownService();
        const markdown = turndown.turndown(htmlContent);
        return new Blob([markdown], { type: 'text/markdown' });

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

    // Matrice delle conversioni supportate (semplificata)
    const supportedConversions: Record<string, ConversionFormat[]> = {
      [ConversionFormat.TXT]: [
        ConversionFormat.MD,
        ConversionFormat.HTML,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.MD]: [
        ConversionFormat.TXT,
        ConversionFormat.HTML,
        ConversionFormat.PDF,
        ConversionFormat.EPUB,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.HTML]: [
        ConversionFormat.TXT,
        ConversionFormat.MD,
        ConversionFormat.RTF,
        ConversionFormat.PDF,
        ConversionFormat.EPUB,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.RTF]: [
        ConversionFormat.HTML,
        ConversionFormat.TXT,
        ConversionFormat.MD,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.CSV]: [
        ConversionFormat.JSON,
        ConversionFormat.XLSX,
        ConversionFormat.YAML,
        ConversionFormat.XML,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.JSON]: [
        ConversionFormat.CSV,
        ConversionFormat.XLSX,
        ConversionFormat.YAML,
        ConversionFormat.XML,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.XLSX]: [
        ConversionFormat.CSV,
        ConversionFormat.JSON,
        ConversionFormat.YAML,
        ConversionFormat.XML,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.YAML]: [ConversionFormat.JSON, ConversionFormat.BASE64],
      [ConversionFormat.XML]: [
        ConversionFormat.JSON,
        ConversionFormat.YAML,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.PDF]: [
        ConversionFormat.TXT,
        ConversionFormat.MD,
        ConversionFormat.HTML,
        ConversionFormat.PNG,
        ConversionFormat.JPEG,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.PNG]: [
        ConversionFormat.JPEG,
        ConversionFormat.WEBP,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.JPEG]: [
        ConversionFormat.PNG,
        ConversionFormat.WEBP,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.JPG]: [
        ConversionFormat.PNG,
        ConversionFormat.WEBP,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.WEBP]: [
        ConversionFormat.PNG,
        ConversionFormat.JPEG,
        ConversionFormat.PDF,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.EPUB]: [
        ConversionFormat.HTML,
        ConversionFormat.TXT,
        ConversionFormat.MD,
        ConversionFormat.BASE64,
      ],
      [ConversionFormat.BASE64]: [ConversionFormat.TXT], // Decode to raw content
    };

    return supportedConversions[sourceFormat]?.includes(targetFormat) || false;
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

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
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

    // Sanitize (rimuove script, XSS protection)
    if (options.htmlSanitize === true) {
      processed = this.htmlService.sanitize(processed);
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
    return SUPPORTED_FORMATS.map((f) => f.format).filter((f) =>
      this.isConversionSupported(sourceFormat, f)
    );
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
}
