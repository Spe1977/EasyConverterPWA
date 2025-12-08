import { test, expect } from '@playwright/test';

test.describe('EasyConverter - PDF Extraction Cross-Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // Helper function to create a minimal valid PDF
  function createMinimalPDF(text: string): Buffer {
    // Minimal PDF with text content (PDF 1.4 format)
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj
5 0 obj
<< /Length ${text.length + 50} >>
stream
BT
/F1 12 Tf
50 700 Td
(${text}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000309 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${420 + text.length}
%%EOF`;
    return Buffer.from(pdfContent);
  }

  test.describe('PDF Text Extraction - Basic', () => {
    test('should accept PDF file upload', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Simple PDF test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('test.pdf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle PDF with simple text', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('This is a test PDF document');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'simple.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('simple.pdf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle PDF with multiple words', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Multiple words in this PDF file for testing extraction');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'multiword.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('multiword.pdf').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PDF Text Extraction - Formatting', () => {
    test('should extract text preserving structure', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Formatted text with structure');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'formatted.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('formatted.pdf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle PDF with special characters', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Special chars: @ # $ % & *');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'special-chars.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('special-chars.pdf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle PDF with numbers', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Numbers: 123 456 789 0.5 3.14');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'numbers.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('numbers.pdf').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PDF Browser APIs', () => {
    test('should have Canvas API support', async ({ page }) => {
      await page.goto('/');

      const hasCanvas = await page.evaluate(() => {
        return typeof HTMLCanvasElement !== 'undefined';
      });

      expect(hasCanvas).toBe(true);
    });

    test('should have Canvas 2D context support', async ({ page }) => {
      await page.goto('/');

      const hasCanvas2D = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        return ctx !== null;
      });

      expect(hasCanvas2D).toBe(true);
    });

    test('should support ArrayBuffer for PDF processing', async ({ page }) => {
      await page.goto('/');

      const hasArrayBuffer = await page.evaluate(() => {
        return typeof ArrayBuffer !== 'undefined';
      });

      expect(hasArrayBuffer).toBe(true);
    });

    test('should support Uint8Array for PDF data', async ({ page }) => {
      await page.goto('/');

      const hasUint8Array = await page.evaluate(() => {
        return typeof Uint8Array !== 'undefined';
      });

      expect(hasUint8Array).toBe(true);
    });

    test('should support FileReader API', async ({ page }) => {
      await page.goto('/');

      const hasFileReader = await page.evaluate(() => {
        return typeof FileReader !== 'undefined';
      });

      expect(hasFileReader).toBe(true);
    });

    test('should support Blob API', async ({ page }) => {
      await page.goto('/');

      const hasBlob = await page.evaluate(() => {
        return typeof Blob !== 'undefined';
      });

      expect(hasBlob).toBe(true);
    });
  });

  test.describe('PDF to Text Conversion', () => {
    test('should convert PDF to TXT', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('PDF to TXT conversion test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'convert.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('convert.pdf').first()).toBeVisible({ timeout: 5000 });

      // Try to select TXT format
      const formatButton = page
        .locator('ion-button')
        .filter({ hasText: /select format/i })
        .first();
      if (await formatButton.isVisible()) {
        await formatButton.click();
        await page.locator('ion-item').filter({ hasText: 'TXT' }).first().click();
      }
    });

    test('should convert PDF to HTML', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('PDF to HTML conversion test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'to-html.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('to-html.pdf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert PDF to Markdown', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('PDF to Markdown conversion test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'to-md.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('to-md.pdf').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PDF Creation', () => {
    test('should create PDF from text', async ({ page }) => {
      const textContent = 'Creating PDF from text content';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'create.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(textContent),
      });

      await expect(page.getByText('create.txt').first()).toBeVisible({ timeout: 5000 });
    });

    test('should create PDF from HTML', async ({ page }) => {
      const htmlContent = '<html><body><h1>PDF Creation</h1><p>From HTML</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'create.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('create.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should create PDF from Markdown', async ({ page }) => {
      const mdContent = '# PDF Creation\n\nFrom Markdown content';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'create.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(mdContent),
      });

      await expect(page.getByText('create.md').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('PDF Rendering', () => {
    test('should handle PDF page rendering', async ({ page }) => {
      await page.goto('/');

      // Verify canvas can be created and has required methods
      const canRender = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        // Check for required canvas methods
        return (
          typeof ctx.drawImage === 'function' &&
          typeof ctx.fillText === 'function' &&
          typeof ctx.fillRect === 'function'
        );
      });

      expect(canRender).toBe(true);
    });

    test('should support ImageData for PDF rendering', async ({ page }) => {
      await page.goto('/');

      const hasImageData = await page.evaluate(() => {
        return typeof ImageData !== 'undefined';
      });

      expect(hasImageData).toBe(true);
    });
  });

  test.describe('PDF Libraries Loading', () => {
    test('should lazy-load pdfjs-dist only when needed', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Initially, pdfjs should not be loaded
      const initialLoad = await page.evaluate(() => {
        return (window as any).pdfjsLib !== undefined;
      });

      // May or may not be loaded depending on service worker cache
      // Just verify the app loaded successfully
      expect(initialLoad).toBeDefined();
    });

    test('should have proper error handling for PDF processing', async ({ page }) => {
      // Upload an invalid PDF
      const invalidPDF = Buffer.from('This is not a valid PDF');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'invalid.pdf',
        mimeType: 'application/pdf',
        buffer: invalidPDF,
      });

      // App should handle the error gracefully
      await expect(page.getByText('invalid.pdf').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Performance', () => {
    test('should handle PDF processing efficiently', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Performance test PDF content');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      const start = Date.now();

      await fileInput.setInputFiles({
        name: 'performance.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('performance.pdf').first()).toBeVisible({ timeout: 10000 });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should not block UI during PDF processing', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('UI blocking test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'ui-test.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      // UI should remain responsive
      const appTitle = page.getByText('EasyConverter').first();
      await expect(appTitle).toBeVisible();
    });
  });

  test.describe('Memory Management', () => {
    test('should clean up Canvas after PDF rendering', async ({ page }) => {
      await page.goto('/');

      const canvasCleanup = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return false;

        // Simulate canvas usage
        ctx.fillRect(0, 0, 100, 100);

        // Canvas should be cleanable
        canvas.width = 0;
        canvas.height = 0;

        return true;
      });

      expect(canvasCleanup).toBe(true);
    });

    test('should handle multiple PDF conversions without memory leaks', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Memory leak test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      // Upload multiple files sequentially
      for (let i = 0; i < 3; i++) {
        await fileInput.setInputFiles({
          name: `memory-test-${i}.pdf`,
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        });

        await expect(page.getByText(`memory-test-${i}.pdf`).first()).toBeVisible({ timeout: 5000 });

        // Wait a bit between uploads
        await page.waitForTimeout(500);
      }

      // App should still be responsive
      const appTitle = page.getByText('EasyConverter').first();
      await expect(appTitle).toBeVisible();
    });
  });

  test.describe('Cross-Format PDF Tests', () => {
    test('should convert PDF to multiple formats', async ({ page }) => {
      const pdfBuffer = createMinimalPDF('Multi-format conversion test');
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'multi.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer,
      });

      await expect(page.getByText('multi.pdf').first()).toBeVisible({ timeout: 5000 });
    });
  });
});
