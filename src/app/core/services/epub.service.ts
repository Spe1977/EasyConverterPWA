import { Injectable } from '@angular/core';
import JSZip from 'jszip';

/**
 * Metadata EPUB3
 */
export interface EpubMetadata {
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  language?: string;
  description?: string;
  pubdate?: string;
  rights?: string;
}

/**
 * Capitolo EPUB
 */
export interface EpubChapter {
  title: string;
  content: string; // HTML content
  filename?: string;
}

/**
 * Opzioni per generazione EPUB
 */
export interface EpubOptions {
  metadata: EpubMetadata;
  chapters: EpubChapter[];
  cover?: Blob; // Cover image (PNG/JPEG)
  css?: string; // Custom CSS
}

/**
 * Service per creare e manipolare file EPUB3
 * Usa JSZip per generare file EPUB completi offline
 */
@Injectable({
  providedIn: 'root',
})
export class EpubService {
  /**
   * Genera un file EPUB3 completo
   * @param options Opzioni con metadati, capitoli, cover, css
   * @returns Blob del file EPUB
   */
  async generateEpub(options: EpubOptions): Promise<Blob> {
    const zip = new JSZip();

    // 1. mimetype (deve essere il primo file, non compresso)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. META-INF/container.xml
    zip.folder('META-INF')!.file('container.xml', this.generateContainerXml());

    // 3. OEBPS folder structure
    const oebps = zip.folder('OEBPS')!;

    // 4. Generate chapter HTML files
    const manifestItems: string[] = [];
    const spineItems: string[] = [];
    const navItems: string[] = [];

    for (let i = 0; i < options.chapters.length; i++) {
      const chapter = options.chapters[i];
      const filename = chapter.filename || `chapter${i + 1}.html`;
      const chapterId = `chapter${i + 1}`;

      // Generate chapter HTML
      const chapterHtml = this.generateChapterHtml(chapter.title, chapter.content, options.css);
      oebps.file(filename, chapterHtml);

      // Add to manifest, spine, and nav
      manifestItems.push(
        `    <item id="${chapterId}" href="${filename}" media-type="application/xhtml+xml"/>`
      );
      spineItems.push(`    <itemref idref="${chapterId}"/>`);
      navItems.push(`      <li><a href="${filename}">${this.escapeXml(chapter.title)}</a></li>`);
    }

    // 5. Add cover image if provided
    let coverImageId = '';
    if (options.cover) {
      const coverFilename = 'cover.jpg';
      const coverMimeType = options.cover.type;
      const coverBytes = await options.cover.arrayBuffer();
      oebps.file(coverFilename, coverBytes);

      coverImageId = 'cover-image';
      manifestItems.unshift(
        `    <item id="${coverImageId}" href="${coverFilename}" media-type="${coverMimeType}" properties="cover-image"/>`
      );
    }

    // 6. content.opf (metadata + manifest + spine)
    oebps.file('content.opf', this.generateContentOpf(options.metadata, manifestItems, spineItems));

    // 7. toc.ncx (navigation for EPUB2 compatibility)
    oebps.file('toc.ncx', this.generateTocNcx(options.metadata, options.chapters));

    // 8. nav.xhtml (EPUB3 navigation)
    oebps.file('nav.xhtml', this.generateNavXhtml(options.metadata.title, navItems));

    // Add nav.xhtml to manifest
    manifestItems.push(
      `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
    );

    // 9. CSS stylesheet (optional)
    if (options.css) {
      oebps.file('styles.css', options.css);
      manifestItems.push(`    <item id="css" href="styles.css" media-type="text/css"/>`);
    }

    // Generate final EPUB zip
    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  }

  /**
   * Genera EPUB semplice da HTML
   * @param htmlContent Contenuto HTML
   * @param title Titolo del libro
   * @param author Autore (opzionale)
   * @returns Blob EPUB
   */
  async generateEpubFromHtml(
    htmlContent: string,
    title: string = 'Document',
    author?: string
  ): Promise<Blob> {
    return this.generateEpub({
      metadata: {
        title,
        author,
        language: 'it',
        pubdate: new Date().toISOString().split('T')[0],
      },
      chapters: [
        {
          title,
          content: htmlContent,
        },
      ],
    });
  }

  /**
   * Genera EPUB da Markdown (convertito in HTML)
   * @param markdownContent Contenuto Markdown
   * @param title Titolo
   * @param author Autore
   * @returns Blob EPUB
   */
  async generateEpubFromMarkdown(
    markdownContent: string,
    title: string = 'Document',
    author?: string
  ): Promise<Blob> {
    // Import marked dinamicamente
    const { marked } = await import('marked');
    const htmlContent = await marked(markdownContent);

    return this.generateEpubFromHtml(htmlContent, title, author);
  }

  /**
   * Estrae contenuto HTML da EPUB
   * @param file File EPUB
   * @returns Contenuto HTML estratto
   */
  async extractHtmlFromEpub(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Leggi content.opf per trovare i file dei capitoli
    const contentOpf = await zip.file('OEBPS/content.opf')?.async('string');
    if (!contentOpf) {
      throw new Error('Invalid EPUB: content.opf not found');
    }

    // Parse content.opf per trovare i file HTML
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(contentOpf, 'text/xml');
    const items = opfDoc.querySelectorAll('manifest item[media-type="application/xhtml+xml"]');

    let fullHtml = '';

    // Estrai contenuto da ogni capitolo
    for (const item of Array.from(items)) {
      const href = item.getAttribute('href');
      if (href && !href.includes('nav.xhtml')) {
        const chapterFile = await zip.file(`OEBPS/${href}`)?.async('string');
        if (chapterFile) {
          // Estrai solo il contenuto del body
          const chapterDoc = parser.parseFromString(chapterFile, 'text/html');
          const body = chapterDoc.querySelector('body');
          if (body) {
            fullHtml += body.innerHTML + '\n\n';
          }
        }
      }
    }

    return fullHtml;
  }

  /**
   * Estrae testo semplice da EPUB
   * @param file File EPUB
   * @returns Testo estratto
   */
  async extractTextFromEpub(file: File): Promise<string> {
    const html = await this.extractHtmlFromEpub(file);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Genera container.xml per EPUB
   */
  private generateContainerXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  /**
   * Genera content.opf (metadati, manifest, spine)
   */
  private generateContentOpf(
    metadata: EpubMetadata,
    manifestItems: string[],
    spineItems: string[]
  ): string {
    const uuid = this.generateUuid();
    const pubdate = metadata.pubdate || new Date().toISOString().split('T')[0];

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${this.escapeXml(metadata.title)}</dc:title>
    ${metadata.author ? `<dc:creator>${this.escapeXml(metadata.author)}</dc:creator>` : ''}
    <dc:language>${metadata.language || 'en'}</dc:language>
    <dc:date>${pubdate}</dc:date>
    ${metadata.publisher ? `<dc:publisher>${this.escapeXml(metadata.publisher)}</dc:publisher>` : ''}
    ${metadata.description ? `<dc:description>${this.escapeXml(metadata.description)}</dc:description>` : ''}
    ${metadata.rights ? `<dc:rights>${this.escapeXml(metadata.rights)}</dc:rights>` : ''}
    ${metadata.isbn ? `<dc:identifier id="isbn">${metadata.isbn}</dc:identifier>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`;
  }

  /**
   * Genera toc.ncx (EPUB2 compatibility)
   */
  private generateTocNcx(metadata: EpubMetadata, chapters: EpubChapter[]): string {
    const uuid = this.generateUuid();
    const navPoints = chapters
      .map((chapter, i) => {
        const filename = chapter.filename || `chapter${i + 1}.html`;
        return `    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>${this.escapeXml(chapter.title)}</text>
      </navLabel>
      <content src="${filename}"/>
    </navPoint>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeXml(metadata.title)}</text>
  </docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
  }

  /**
   * Genera nav.xhtml (EPUB3 navigation)
   */
  private generateNavXhtml(title: string, navItems: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${this.escapeXml(title)}</h1>
    <ol>
${navItems.join('\n')}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Genera HTML per un capitolo
   */
  private generateChapterHtml(title: string, content: string, css?: string): string {
    const cssLink = css ? '<link rel="stylesheet" type="text/css" href="styles.css"/>' : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(title)}</title>
  ${cssLink}
</head>
<body>
  <h1>${this.escapeXml(title)}</h1>
  ${content}
</body>
</html>`;
  }

  /**
   * Genera UUID v4
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
