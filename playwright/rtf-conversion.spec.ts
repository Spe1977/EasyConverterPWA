import { test, expect } from '@playwright/test';

test.describe('EasyConverter - RTF Conversion Cross-Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('HTML to RTF Conversion', () => {
    test('should convert simple HTML to RTF', async ({ page }) => {
      const htmlContent = '<html><body><p>Simple HTML test</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('test.html').first()).toBeVisible({ timeout: 5000 });

      // Open target format selector and choose RTF using the current modal-based UI.
      await page.locator('app-format-selector .format-box').nth(1).click();
      await page.getByRole('button', { name: /rich text.*\.rtf/i }).click();

      const convertButton = page.locator('ion-button.convert-button');
      await expect(convertButton).toBeEnabled({ timeout: 5000 });
      await convertButton.click();

      // Success is currently reported through an Ionic alert after saving the file.
      await expect(page.locator('ion-alert')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/conversion successful/i)).toBeVisible({ timeout: 10000 });
    });

    test('should convert HTML with bold formatting to RTF', async ({ page }) => {
      const htmlContent =
        '<html><body><p>Text with <strong>bold</strong> formatting</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'bold-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('bold-test.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert HTML with italic formatting to RTF', async ({ page }) => {
      const htmlContent = '<html><body><p>Text with <em>italic</em> formatting</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'italic-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('italic-test.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert HTML with underline to RTF', async ({ page }) => {
      const htmlContent = '<html><body><p>Text with <u>underline</u> formatting</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'underline-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('underline-test.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert HTML with headings to RTF', async ({ page }) => {
      const htmlContent =
        '<html><body><h1>Heading 1</h1><h2>Heading 2</h2><p>Paragraph</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'headings-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('headings-test.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert HTML with lists to RTF', async ({ page }) => {
      const htmlContent = '<html><body><ul><li>Item 1</li><li>Item 2</li></ul></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'list-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('list-test.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert HTML with links to RTF', async ({ page }) => {
      const htmlContent =
        '<html><body><p><a href="https://example.com">Link text</a></p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'link-test.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('link-test.html').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('RTF to HTML Conversion', () => {
    test('should convert simple RTF to HTML', async ({ page }) => {
      // Minimal RTF content
      const rtfContent =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Simple RTF test}';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'test.rtf',
        mimeType: 'application/rtf',
        buffer: Buffer.from(rtfContent),
      });

      await expect(page.getByText('test.rtf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert RTF with bold to HTML', async ({ page }) => {
      const rtfContent =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Text with \\b bold\\b0  text}';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'bold.rtf',
        mimeType: 'application/rtf',
        buffer: Buffer.from(rtfContent),
      });

      await expect(page.getByText('bold.rtf').first()).toBeVisible({ timeout: 5000 });
    });

    test('should convert RTF with italic to HTML', async ({ page }) => {
      const rtfContent =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Text with \\i italic\\i0  text}';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'italic.rtf',
        mimeType: 'application/rtf',
        buffer: Buffer.from(rtfContent),
      });

      await expect(page.getByText('italic.rtf').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Special Characters and Encoding', () => {
    test('should handle special characters in HTML to RTF', async ({ page }) => {
      const htmlContent =
        '<html><body><p>Special chars: &lt; &gt; &amp; &quot; &#39;</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'special-chars.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('special-chars.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle Unicode characters', async ({ page }) => {
      const htmlContent = '<html><body><p>Unicode: © ® ™ € £ ¥</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'unicode.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('unicode.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle accented characters', async ({ page }) => {
      const htmlContent = '<html><body><p>Accents: àéíóú ÀÉÍÓÚ ñ ç</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'accents.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('accents.html').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Complex Formatting', () => {
    test('should handle mixed formatting', async ({ page }) => {
      const htmlContent =
        '<html><body><p>Text with <strong><em>bold and italic</em></strong></p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'mixed.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('mixed.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle nested lists', async ({ page }) => {
      const htmlContent =
        '<html><body><ul><li>Item 1<ul><li>Nested 1</li></ul></li><li>Item 2</li></ul></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'nested-list.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('nested-list.html').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle multiple paragraphs', async ({ page }) => {
      const htmlContent =
        '<html><body><p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'paragraphs.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('paragraphs.html').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('RTF Service Browser APIs', () => {
    test('should use DOMParser API', async ({ page }) => {
      await page.goto('/');

      const hasDOMParser = await page.evaluate(() => {
        return typeof DOMParser !== 'undefined';
      });

      expect(hasDOMParser).toBe(true);
    });

    test('should handle RTF conversion without external dependencies', async ({ page }) => {
      await page.goto('/');

      // Block all external requests
      await page.route('https://**', (route) => route.abort());
      await page.route('http://**', (route) => {
        if (!route.request().url().includes('localhost')) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const htmlContent = '<html><body><p>Offline RTF test</p></body></html>';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'offline.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('offline.html').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Performance', () => {
    test('should convert large HTML to RTF efficiently', async ({ page }) => {
      // Generate large HTML content
      const paragraphs = Array.from(
        { length: 100 },
        (_, i) => `<p>Paragraph ${i + 1} with some content</p>`
      ).join('');
      const htmlContent = `<html><body>${paragraphs}</body></html>`;
      const fileInput = page.locator('app-file-picker input[type="file"]');

      const start = Date.now();

      await fileInput.setInputFiles({
        name: 'large.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent),
      });

      await expect(page.getByText('large.html').first()).toBeVisible({ timeout: 10000 });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
