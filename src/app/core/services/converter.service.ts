import { Injectable, inject } from '@angular/core';
import { ConversionFormat, SUPPORTED_FORMATS } from '@core/models/conversion-format';
import { ConversionResult, ConversionOptions } from '@core/models/conversion-result';
import { PdfService } from './pdf.service';
import { ImageService } from './image.service';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { marked } from 'marked';
import TurndownService from 'turndown';

/**
 * Service principale per gestire tutte le conversioni tra formati
 * Coordina gli altri servizi specializzati (PDF, Image, ecc.)
 */
@Injectable({
  providedIn: 'root',
})
export class ConverterService {
  private pdfService = inject(PdfService);
  private imageService = inject(ImageService);
  private turndownService = new TurndownService();

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
      } else if (sourceFormat === ConversionFormat.PDF) {
        blob = await this.convertFromPdf(file, targetFormat, options);
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
      return this.imageService.convertImage(file, targetFormat, options.quality || 85);
    }

    // Immagine -> PDF
    if (targetFormat === ConversionFormat.PDF) {
      const imageType = sourceFormat === ConversionFormat.PNG ? 'png' : 'jpeg';
      const pdfBytes = await this.pdfService.createPdfFromImage(file, imageType);
      return new Blob([pdfBytes], { type: 'application/pdf' });
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
        const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body><pre>${this.escapeHtml(content)}</pre></body>
</html>`;
        return new Blob([htmlContent], { type: 'text/html' });

      case ConversionFormat.PDF:
        // TXT -> PDF
        const pdfBytes = await this.pdfService.createPdfFromText(content, {
          fontSize: options['fontSize'] || 12,
        });
        return new Blob([pdfBytes], { type: 'application/pdf' });

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
    switch (targetFormat) {
      case ConversionFormat.TXT:
        // MD -> TXT (remove markdown syntax)
        const txtContent = this.turndownService.turndown(await marked(content));
        return new Blob([txtContent], { type: 'text/plain' });

      case ConversionFormat.HTML:
        // MD -> HTML
        const htmlContent = await marked(content);
        const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Document</title></head>
<body>${htmlContent}</body>
</html>`;
        return new Blob([fullHtml], { type: 'text/html' });

      case ConversionFormat.PDF:
        // MD -> HTML -> PDF
        const html = await marked(content);
        const pdfBytes = await this.pdfService.createPdfFromHtml(html);
        return new Blob([pdfBytes], { type: 'application/pdf' });

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
        const markdown = this.turndownService.turndown(content);
        return new Blob([markdown], { type: 'text/markdown' });

      case ConversionFormat.PDF:
        // HTML -> PDF
        const pdfBytes = await this.pdfService.createPdfFromHtml(content);
        return new Blob([pdfBytes], { type: 'application/pdf' });

      default:
        throw new Error(`Conversion from HTML to ${targetFormat} not supported`);
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
    let workbook: XLSX.WorkBook;

    // Carica il file nello workbook
    if (sourceFormat === ConversionFormat.CSV) {
      const text = await this.readFileAsText(file);
      workbook = XLSX.read(text, { type: 'string' });
    } else if (sourceFormat === ConversionFormat.JSON) {
      const text = await this.readFileAsText(file);
      const json = JSON.parse(text);
      const worksheet = XLSX.utils.json_to_sheet(json);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    } else {
      // XLSX, ODS
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      workbook = XLSX.read(arrayBuffer, { type: 'array' });
    }

    // Converti al formato target
    switch (targetFormat) {
      case ConversionFormat.CSV:
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([csv], { type: 'text/csv' });

      case ConversionFormat.JSON:
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });

      case ConversionFormat.XLSX:
        const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        return new Blob([xlsxBuffer], { type: this.getMimeType(ConversionFormat.XLSX) });

      case ConversionFormat.HTML:
        const htmlTable = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([htmlTable], { type: 'text/html' });

      case ConversionFormat.TXT:
        const txtData = XLSX.utils.sheet_to_txt(workbook.Sheets[workbook.SheetNames[0]]);
        return new Blob([txtData], { type: 'text/plain' });

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

      default:
        throw new Error(`Conversion from PDF to ${targetFormat} not supported`);
    }
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
      [ConversionFormat.TXT]: [ConversionFormat.MD, ConversionFormat.HTML, ConversionFormat.PDF],
      [ConversionFormat.MD]: [ConversionFormat.TXT, ConversionFormat.HTML, ConversionFormat.PDF],
      [ConversionFormat.HTML]: [ConversionFormat.TXT, ConversionFormat.MD, ConversionFormat.PDF],
      [ConversionFormat.CSV]: [
        ConversionFormat.JSON,
        ConversionFormat.XLSX,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
      ],
      [ConversionFormat.JSON]: [
        ConversionFormat.CSV,
        ConversionFormat.XLSX,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
      ],
      [ConversionFormat.XLSX]: [
        ConversionFormat.CSV,
        ConversionFormat.JSON,
        ConversionFormat.HTML,
        ConversionFormat.TXT,
      ],
      [ConversionFormat.PDF]: [
        ConversionFormat.TXT,
        ConversionFormat.MD,
        ConversionFormat.HTML,
        ConversionFormat.PNG,
        ConversionFormat.JPEG,
      ],
      [ConversionFormat.PNG]: [ConversionFormat.JPEG, ConversionFormat.WEBP, ConversionFormat.PDF],
      [ConversionFormat.JPEG]: [ConversionFormat.PNG, ConversionFormat.WEBP, ConversionFormat.PDF],
      [ConversionFormat.JPG]: [ConversionFormat.PNG, ConversionFormat.WEBP, ConversionFormat.PDF],
      [ConversionFormat.WEBP]: [ConversionFormat.PNG, ConversionFormat.JPEG, ConversionFormat.PDF],
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
    return [ConversionFormat.TXT, ConversionFormat.MD, ConversionFormat.HTML].includes(format);
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
