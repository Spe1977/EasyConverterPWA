import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Service per gestire operazioni su file PDF
 * Utilizza pdf-lib per creazione e modifica, pdfjs-dist per lettura (lazy loaded)
 */
@Injectable({
  providedIn: 'root',
})
export class PdfService {
  /**
   * Crea un PDF da testo semplice
   * @param text Testo da inserire nel PDF
   * @param options Opzioni di formattazione
   * @returns PDF come Uint8Array
   */
  async createPdfFromText(
    text: string,
    options: {
      fontSize?: number;
      margin?: number;
      pageWidth?: number;
      pageHeight?: number;
    } = {}
  ): Promise<Uint8Array> {
    const {
      fontSize = 12,
      margin = 50,
      pageWidth = 595, // A4 width in points
      pageHeight = 842, // A4 height in points
    } = options;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Sanitizza il testo per rimuovere caratteri non supportati da WinAnsi
    const sanitizedText = this.sanitizeTextForPdf(text);

    // Calcola area di testo disponibile
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    // Dividi il testo in righe
    const lines = this.wrapText(sanitizedText, font, fontSize, maxWidth);

    // Calcola quante righe per pagina
    const lineHeight = fontSize * 1.2;
    const linesPerPage = Math.floor(maxHeight / lineHeight);

    // Crea pagine necessarie
    let currentLine = 0;
    while (currentLine < lines.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const pageLines = lines.slice(currentLine, currentLine + linesPerPage);

      let yPosition = pageHeight - margin;
      for (const line of pageLines) {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;
      }

      currentLine += linesPerPage;
    }

    return pdfDoc.save();
  }

  /**
   * Crea un PDF da un'immagine
   * @param imageBlob Blob dell'immagine
   * @param imageType Tipo di immagine ('png' | 'jpeg')
   * @returns PDF come Uint8Array
   */
  async createPdfFromImage(imageBlob: Blob, imageType: 'png' | 'jpeg'): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const imageBytes = await imageBlob.arrayBuffer();

    const image =
      imageType === 'png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);

    // Crea pagina con dimensioni dell'immagine
    const page = pdfDoc.addPage([image.width, image.height]);

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    return pdfDoc.save();
  }

  /**
   * Crea un PDF da multiple immagini (una per pagina)
   * @param images Array di blob immagini
   * @param imageType Tipo di immagini
   * @returns PDF come Uint8Array
   */
  async createPdfFromImages(images: Blob[], imageType: 'png' | 'jpeg'): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();

    for (const imageBlob of images) {
      const imageBytes = await imageBlob.arrayBuffer();
      const image =
        imageType === 'png' ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    return pdfDoc.save();
  }

  /**
   * Estrae testo da un PDF (lazy load pdfjs-dist)
   * @param file File PDF
   * @returns Testo estratto
   */
  async extractTextFromPdf(file: File): Promise<string> {
    // Lazy load pdfjs-dist solo quando necessario
    const pdfjsLib = await import('pdfjs-dist');

    // Configura worker URL direttamente
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    // Estrai testo da ogni pagina
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  }

  /**
   * Converte una pagina PDF in immagine (canvas)
   * @param file File PDF
   * @param pageNumber Numero pagina (1-based)
   * @param scale Scala di rendering (default 2.0 per alta qualità)
   * @returns Blob dell'immagine
   */
  async convertPdfPageToImage(
    file: File,
    pageNumber: number = 1,
    scale: number = 2.0
  ): Promise<Blob> {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    } as any).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      }, 'image/png');
    });
  }

  /**
   * Converte tutte le pagine di un PDF in immagini
   * @param file File PDF
   * @param scale Scala di rendering
   * @returns Array di blob immagini
   */
  async convertPdfToImages(file: File, scale: number = 2.0): Promise<Blob[]> {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const images: Blob[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const image = await this.convertPdfPageToImage(file, i, scale);
      images.push(image);
    }

    return images;
  }

  /**
   * Unisce più PDF in uno solo
   * @param pdfFiles Array di file PDF
   * @returns PDF unificato come Uint8Array
   */
  async mergePdfs(pdfFiles: File[]): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return mergedPdf.save();
  }

  /**
   * Estrae pagine specifiche da un PDF
   * @param file File PDF originale
   * @param pageNumbers Array di numeri di pagina (1-based)
   * @returns PDF con solo le pagine selezionate
   */
  async extractPages(file: File, pageNumbers: number[]): Promise<Uint8Array> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();

    // Converti page numbers da 1-based a 0-based
    const indices = pageNumbers.map((n) => n - 1);

    const copiedPages = await newPdf.copyPages(pdfDoc, indices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    return newPdf.save();
  }

  /**
   * Ruota pagine di un PDF
   * @param file File PDF
   * @param degrees Angolo di rotazione (90, 180, 270)
   * @param pageNumbers Numeri pagine da ruotare (vuoto = tutte)
   * @returns PDF con pagine ruotate
   */
  async rotatePdf(
    file: File,
    degrees: 90 | 180 | 270,
    pageNumbers?: number[]
  ): Promise<Uint8Array> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const pages = pdfDoc.getPages();
    const pagesToRotate = pageNumbers ? pageNumbers.map((n) => n - 1) : pages.map((_, i) => i);

    pagesToRotate.forEach((index) => {
      if (index >= 0 && index < pages.length) {
        const page = pages[index];
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + degrees) % 360;
        page.setRotation({ angle: newRotation } as any);
      }
    });

    return pdfDoc.save();
  }

  /**
   * Ottieni informazioni su un PDF
   * @param file File PDF
   * @returns Metadati del PDF
   */
  async getPdfInfo(file: File): Promise<{
    numPages: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const numPages = pdfDoc.getPageCount();
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const subject = pdfDoc.getSubject();
    const keywords = pdfDoc.getKeywords();

    return {
      numPages,
      title,
      author,
      subject,
      keywords,
    };
  }

  /**
   * Divide il testo in righe che si adattano alla larghezza specificata
   */
  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    const lines: string[] = [];

    // Prima dividi per newline per preservare le interruzioni di riga intenzionali
    const paragraphs = text.split(/\r?\n/);

    for (const paragraph of paragraphs) {
      // Se il paragrafo è vuoto, aggiungi una riga vuota
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }

      // Applica word wrapping al paragrafo
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Sanitizza il testo per rimuovere caratteri non supportati dal charset WinAnsi
   * WinAnsi supporta solo caratteri ASCII base e alcuni caratteri dell'Europa occidentale
   */
  private sanitizeTextForPdf(text: string): string {
    // Mappa di sostituzioni per caratteri Unicode comuni
    const replacements: { [key: string]: string } = {
      // Checkmarks e simboli
      '\u2713': '[v]', // ✓
      '\u2714': '[v]', // ✔
      '\u2717': '[x]', // ✗
      '\u2718': '[x]', // ✘
      '\u2610': '[ ]', // ☐
      '\u2611': '[v]', // ☑
      '\u2612': '[x]', // ☒
      // Quote tipografiche
      '\u201C': '"', // "
      '\u201D': '"', // "
      '\u2018': "'", // '
      '\u2019': "'", // '
      '\u00AB': '"', // «
      '\u00BB': '"', // »
      // Trattini e spazi speciali
      '\u2014': '-', // em dash —
      '\u2013': '-', // en dash –
      '\u2212': '-', // minus −
      '\u00A0': ' ', // non-breaking space
      '\u2003': ' ', // em space
      '\u2009': ' ', // thin space
      // Punti elenco
      '\u2022': '*', // •
      '\u25E6': '-', // ◦
      '\u25AA': '*', // ▪
      '\u25AB': '-', // ▫
      // Frecce
      '\u2192': '->', // →
      '\u2190': '<-', // ←
      '\u2191': '^', // ↑
      '\u2193': 'v', // ↓
      '\u21D2': '=>', // ⇒
      '\u21D0': '<=', // ⇐
      // Altri simboli comuni
      '\u2122': '(TM)', // ™
      '\u00A9': '(C)', // ©
      '\u00AE': '(R)', // ®
      '\u00B0': 'deg', // °
      '\u00B1': '+/-', // ±
      '\u00D7': 'x', // ×
      '\u00F7': '/', // ÷
      '\u2026': '...', // …
    };

    // Applica le sostituzioni
    let sanitized = text;
    for (const [unicode, replacement] of Object.entries(replacements)) {
      sanitized = sanitized.split(unicode).join(replacement);
    }

    // Rimuovi tutti i caratteri che non sono nel range WinAnsi (0x20-0xFF)
    // Mantieni caratteri ASCII stampabili e caratteri Latin-1
    sanitized = sanitized.replace(/[^\x20-\xFF]/g, '');

    return sanitized;
  }

  /**
   * Crea un PDF da HTML (semplificato - solo testo)
   * @param htmlContent Contenuto HTML
   * @returns PDF come Uint8Array
   */
  async createPdfFromHtml(htmlContent: string): Promise<Uint8Array> {
    // Estrai solo il testo dall'HTML (parsing semplice)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';

    return this.createPdfFromText(text);
  }
}
