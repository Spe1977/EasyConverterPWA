import { test, expect, Page } from '@playwright/test';
import JSZip from 'jszip';

/**
 * Helper: upload a file, select target format, click convert, verify success alert.
 * Returns the downloaded output content as a string for content verification.
 *
 * @param sourceFormatLabel - The label shown in the source format box after detection (e.g. "Testo", "HTML")
 * @param targetFormatLabel - The label to match in the target format modal (e.g. "Markdown", "HTML")
 */
/**
 * Select a format from the currently open Ionic modal. Handles cross-browser differences:
 * - WebKit may need programmatic dismiss when ion-item click doesn't propagate to Angular
 * - Uses .show-modal class as the standard indicator of an open Ionic modal
 */
async function selectFormatFromModal(page: Page, formatLabel: string): Promise<void> {
  const modal = page.locator('ion-modal.show-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });

  // Wait for ion-item content to render (ng-template lazy loading)
  const item = modal.locator('ion-item').filter({ hasText: formatLabel });
  await expect(item.first()).toBeVisible({ timeout: 10000 });

  // Click item via JS to avoid Ionic overlay interception
  await item.first().evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(300);

  // If modal didn't close (WebKit ion-item click doesn't trigger Angular handler),
  // dismiss via Ionic's modal controller
  if (await modal.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const m = document.querySelector('ion-modal.show-modal');
      if (m) (m as any).dismiss();
    });
  }
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}

async function uploadFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer }
): Promise<void> {
  const fileInput = page.locator('app-file-picker input[type="file"]');

  // Use DataTransfer API to set files and dispatch a single change event.
  // This is more reliable across browsers than setInputFiles, which on WebKit
  // may not properly trigger Angular's event handling.
  await fileInput.evaluate(
    (el, { content, name, mimeType }) => {
      const input = el as HTMLInputElement;
      input.style.display = 'block';
      const uint8 = new Uint8Array(content);
      const blob = new Blob([uint8], { type: mimeType });
      const f = new File([blob], name, { type: mimeType });
      const dt = new DataTransfer();
      dt.items.add(f);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.style.display = 'none';
    },
    { content: Array.from(file.buffer), name: file.name, mimeType: file.mimeType }
  );
}

async function convertFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  sourceFormatLabel: string,
  targetFormatLabel: string
): Promise<string> {
  await uploadFile(page, file);

  await expect(page.getByText(file.name).first()).toBeVisible({ timeout: 10000 });

  // Wait for the format selector to mount and source format to be auto-detected.
  // The effect-based sync in FormatSelectorComponent ensures the UI updates
  // once async detectFormatFromContent completes.
  const sourceFormatName = page
    .locator('app-format-selector .format-box')
    .nth(0)
    .locator('.format-name');
  try {
    await expect(sourceFormatName).toBeVisible({ timeout: 10000 });
  } catch {
    // Fallback: open source format modal and select manually
    const sourceBox = page.locator('app-format-selector .format-box').nth(0);
    await sourceBox.evaluate((el: HTMLElement) => el.click());
    await selectFormatFromModal(page, sourceFormatLabel);
  }

  // Open target format modal using a DOM click to avoid cross-browser actionability issues.
  await page
    .locator('app-format-selector .format-box')
    .nth(1)
    .evaluate((el: HTMLElement) => el.click());
  await selectFormatFromModal(page, targetFormatLabel);

  // Convert button should be enabled
  const convertButton = page.locator('ion-button.convert-button');
  await expect(convertButton).toBeEnabled({ timeout: 5000 });

  // Start waiting for download BEFORE clicking convert
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await convertButton.click();

  // Capture the downloaded file content
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const fs = await import('fs');
  const downloadedContent = fs.readFileSync(downloadPath!);

  // Verify success alert
  await expect(page.locator('ion-alert')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/conversion successful/i)).toBeVisible({ timeout: 30000 });

  // Dismiss alert
  await page.locator('ion-alert').getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('ion-alert')).not.toBeVisible({ timeout: 5000 });

  return downloadedContent.toString('utf-8');
}

/**
 * Helper: create a minimal valid EPUB buffer.
 */
async function createMinimalEpub(): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">test-epub-001</dc:identifier>
    <dc:title>Test EPUB</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`
  );

  zip.file(
    'OEBPS/chapter1.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter One</h1>
  <p>This is the first chapter of the test EPUB document.</p>
  <p>It contains multiple paragraphs for testing purposes.</p>
</body>
</html>`
  );

  const arrayBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(arrayBuffer);
}

test.describe('EasyConverter - Real Conversions E2E', () => {
  // Serial mode avoids WebKit instability when multiple browser contexts
  // hit the same static server in parallel
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });
  });

  test.describe('TXT conversions', () => {
    const txtFile = {
      name: 'sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello World\nThis is a test document.\nWith multiple lines.'),
    };

    test('TXT → Markdown', async ({ page }) => {
      const output = await convertFile(page, txtFile, 'Testo', 'Markdown');
      expect(output).toContain('Hello World');
      expect(output).toContain('multiple lines');
    });

    test('TXT → HTML', async ({ page }) => {
      const output = await convertFile(page, txtFile, 'Testo', 'HTML');
      expect(output).toContain('Hello World');
      expect(output).toContain('<');
      expect(output).toContain('multiple lines');
    });
  });

  test.describe('Markdown conversions', () => {
    const mdFile = {
      name: 'sample.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Heading\n\nA paragraph with **bold** and _italic_ text.\n\n- Item 1\n- Item 2\n'
      ),
    };

    test('MD → TXT', async ({ page }) => {
      const output = await convertFile(page, mdFile, 'Markdown', 'Testo');
      expect(output).toContain('Heading');
      expect(output).toContain('Item 1');
      expect(output).toContain('Item 2');
    });

    test('MD → HTML', async ({ page }) => {
      const output = await convertFile(page, mdFile, 'Markdown', 'HTML');
      expect(output).toContain('<h1');
      expect(output).toContain('Heading');
      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
    });
  });

  test.describe('HTML conversions', () => {
    const htmlFile = {
      name: 'sample.html',
      mimeType: 'text/html',
      buffer: Buffer.from(
        '<html><body><h1>Test</h1><p>Paragraph with <strong>bold</strong> text.</p></body></html>'
      ),
    };

    test('HTML → TXT', async ({ page }) => {
      const output = await convertFile(page, htmlFile, 'HTML', 'Testo');
      expect(output).toContain('Test');
      expect(output).toContain('bold');
      expect(output).toContain('Paragraph');
    });

    test('HTML → Markdown', async ({ page }) => {
      const output = await convertFile(page, htmlFile, 'HTML', 'Markdown');
      // Turndown may use setext-style (====) or atx-style (# Test) for h1
      expect(output).toMatch(/# Test|Test\n=+/);
      expect(output).toContain('**bold**');
    });

    test('HTML → CSV neutralizes spreadsheet formulas', async ({ page }) => {
      const formulaHtmlFile = {
        name: 'table.html',
        mimeType: 'text/html',
        buffer: Buffer.from(
          '<table><tr><th>Name</th><th>Payload</th></tr><tr><td>Ada</td><td>=2+2</td></tr></table>'
        ),
      };

      const output = await convertFile(page, formulaHtmlFile, 'HTML', 'CSV');
      expect(output).toContain("Ada,'=2+2");
    });
  });

  test.describe('CSV → JSON', () => {
    test('CSV → JSON', async ({ page }) => {
      const csvFile = {
        name: 'data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('name,age,city\nAlice,30,Rome\nBob,25,Milan\nCarol,35,Naples\n'),
      };
      const output = await convertFile(page, csvFile, 'CSV', 'JSON');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed[0].name).toBe('Alice');
      expect(parsed[0].city).toBe('Rome');
      expect(parsed[1].name).toBe('Bob');
      expect(parsed[2].name).toBe('Carol');
    });
  });

  test.describe('RTF conversions', () => {
    const rtfFile = {
      name: 'document.rtf',
      mimeType: 'application/rtf',
      buffer: Buffer.from(
        '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24 This is a \\b bold\\b0  and \\i italic\\i0  RTF document.\\par Second paragraph here.}'
      ),
    };

    test('RTF → HTML', async ({ page }) => {
      const output = await convertFile(page, rtfFile, 'Rich Text', 'HTML');
      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
      expect(output).toContain('RTF document');
    });

    test('RTF → TXT', async ({ page }) => {
      const output = await convertFile(page, rtfFile, 'Rich Text', 'Testo');
      expect(output).toContain('bold');
      expect(output).toContain('italic');
      expect(output).toContain('RTF document');
      expect(output).toContain('Second paragraph');
    });
  });

  test.describe('EPUB conversions', () => {
    let epubBuffer: Buffer;

    test.beforeAll(async () => {
      epubBuffer = await createMinimalEpub();
    });

    test('EPUB → TXT', async ({ page }) => {
      const output = await convertFile(
        page,
        { name: 'book.epub', mimeType: 'application/epub+zip', buffer: epubBuffer },
        'EPUB',
        'Testo'
      );
      expect(output).toContain('Chapter One');
      expect(output).toContain('first chapter');
      expect(output).toContain('testing purposes');
    });

    test('EPUB → HTML', async ({ page }) => {
      const output = await convertFile(
        page,
        { name: 'book.epub', mimeType: 'application/epub+zip', buffer: epubBuffer },
        'EPUB',
        'HTML'
      );
      expect(output).toContain('<h1');
      expect(output).toContain('Chapter One');
      expect(output).toContain('first chapter');
    });
  });
});
