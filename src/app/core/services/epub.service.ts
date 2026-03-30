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
   * Legge container.xml per trovare il rootfile, segue l'ordine dello spine,
   * filtra i documenti di navigazione e preserva gli stili CSS inline.
   * @param file File EPUB
   * @returns Contenuto HTML estratto
   */
  async extractHtmlFromEpub(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();

    // 1. Trova il rootfile path da container.xml
    const rootfilePath = await this.findRootfilePath(zip, parser);

    // 2. Leggi e parsa content.opf
    const contentOpf = await zip.file(rootfilePath)?.async('string');
    if (!contentOpf) {
      throw new Error(`Invalid EPUB: content.opf not found at ${rootfilePath}`);
    }

    const opfDoc = parser.parseFromString(contentOpf, 'text/xml');
    const opfDir = rootfilePath.includes('/')
      ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
      : '';

    // 3. Costruisci mappa manifest id -> {href, properties, mediaType}
    const manifestMap = new Map<string, { href: string; properties: string; mediaType: string }>();
    const manifestItems = opfDoc.querySelectorAll('manifest item');
    for (const item of Array.from(manifestItems)) {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type') || '';
      const properties = item.getAttribute('properties') || '';
      if (id && href) {
        manifestMap.set(id, { href, properties, mediaType });
      }
    }

    // 4. Identifica gli id dei documenti di navigazione da escludere
    const navIds = new Set<string>();
    for (const [id, info] of manifestMap) {
      if (info.properties.includes('nav')) {
        navIds.add(id);
      }
    }

    // 5. Estrai CSS dai fogli di stile referenziati nel manifest
    const cssContent = await this.extractEpubCss(zip, opfDir, manifestMap);

    // 6. Segui l'ordine dello spine per leggere i capitoli
    const spineItems = opfDoc.querySelectorAll('spine itemref');
    const orderedIds: string[] = [];
    for (const itemref of Array.from(spineItems)) {
      const idref = itemref.getAttribute('idref');
      if (idref && !navIds.has(idref)) {
        orderedIds.push(idref);
      }
    }

    // Fallback: se lo spine è vuoto, usa tutti gli item XHTML dal manifest (esclusi nav)
    if (orderedIds.length === 0) {
      for (const [id, info] of manifestMap) {
        if (info.mediaType === 'application/xhtml+xml' && !navIds.has(id)) {
          orderedIds.push(id);
        }
      }
    }

    // 7. Estrai HTML da ogni capitolo nell'ordine dello spine
    let fullHtml = '';
    for (const id of orderedIds) {
      const info = manifestMap.get(id);
      if (!info || info.mediaType !== 'application/xhtml+xml') continue;

      // Decode percent-encoded hrefs (e.g. "Chapter%201.xhtml" -> "Chapter 1.xhtml")
      const decodedHref = this.decodeEpubHref(info.href);
      const filePath = opfDir + decodedHref;
      // Try decoded path first, then original href as fallback
      const zipEntry = zip.file(filePath) ?? zip.file(opfDir + info.href);
      const chapterFile = await zipEntry?.async('string');
      if (chapterFile) {
        const chapterDoc = parser.parseFromString(chapterFile, 'text/html');
        const body = chapterDoc.querySelector('body');
        if (body) {
          fullHtml += body.innerHTML + '\n\n';
        }
      }
      // Gracefully skip missing spine items instead of crashing
    }

    if (!fullHtml.trim()) {
      throw new Error('Invalid EPUB: no readable chapter content found');
    }

    // 8. Se CSS presente, wrappa in uno style tag per preservare la formattazione
    if (cssContent) {
      fullHtml = `<style>${cssContent}</style>\n${fullHtml}`;
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
    // HTML proviene dalla nostra estrazione EPUB interna, non da input utente esterno
    tempDiv.innerHTML = html;
    // Rimuovi i tag <style> per evitare che il CSS finisca nel testo estratto
    for (const style of Array.from(tempDiv.querySelectorAll('style'))) {
      style.remove();
    }
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  /**
   * Trova il path del rootfile (content.opf) leggendo META-INF/container.xml.
   * Fallback su OEBPS/content.opf se container.xml non è presente o non valido.
   */
  private async findRootfilePath(zip: JSZip, parser: DOMParser): Promise<string> {
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (containerXml) {
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');
      const rootfile = containerDoc.querySelector('rootfile');
      const fullPath = rootfile?.getAttribute('full-path');
      if (fullPath) {
        return fullPath;
      }
    }
    // Fallback: prova percorsi comuni
    for (const candidate of ['OEBPS/content.opf', 'OPS/content.opf', 'content.opf']) {
      if (zip.file(candidate)) {
        return candidate;
      }
    }
    throw new Error('Invalid EPUB: cannot locate content.opf');
  }

  /**
   * Estrae e concatena i fogli di stile CSS referenziati nel manifest EPUB.
   */
  private async extractEpubCss(
    zip: JSZip,
    opfDir: string,
    manifestMap: Map<string, { href: string; properties: string; mediaType: string }>
  ): Promise<string> {
    const cssFragments: string[] = [];
    for (const [, info] of manifestMap) {
      if (info.mediaType === 'text/css') {
        const decodedHref = this.decodeEpubHref(info.href);
        const cssFile =
          (await zip.file(opfDir + decodedHref)?.async('string')) ??
          (await zip.file(opfDir + info.href)?.async('string'));
        if (cssFile) {
          cssFragments.push(cssFile);
        }
      }
    }
    return cssFragments.join('\n');
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
   * Estrae metadati (titolo, autore, lingua) dal content.opf di un EPUB.
   * @param file File EPUB
   * @returns Metadati estratti
   */
  async extractMetadataFromEpub(file: File): Promise<EpubMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();

    const rootfilePath = await this.findRootfilePath(zip, parser);
    const contentOpf = await zip.file(rootfilePath)?.async('string');
    if (!contentOpf) {
      throw new Error(`Invalid EPUB: content.opf not found at ${rootfilePath}`);
    }

    const opfDoc = parser.parseFromString(contentOpf, 'text/xml');

    const getText = (selector: string): string | undefined => {
      const el = opfDoc.querySelector(selector);
      return el?.textContent?.trim() || undefined;
    };

    return {
      title: getText('metadata title') || getText('metadata dc\\:title') || 'Unknown',
      author: getText('metadata creator') || getText('metadata dc\\:creator'),
      publisher: getText('metadata publisher') || getText('metadata dc\\:publisher'),
      language: getText('metadata language') || getText('metadata dc\\:language'),
      description: getText('metadata description') || getText('metadata dc\\:description'),
      pubdate: getText('metadata date') || getText('metadata dc\\:date'),
      rights: getText('metadata rights') || getText('metadata dc\\:rights'),
    };
  }

  /**
   * Decode percent-encoded EPUB hrefs (e.g. "Chapter%201.xhtml" -> "Chapter 1.xhtml").
   * Falls back to the original string if decoding fails.
   */
  private decodeEpubHref(href: string): string {
    try {
      return decodeURIComponent(href);
    } catch {
      return href;
    }
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
