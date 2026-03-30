import { test, expect, Page } from '@playwright/test';

// Ionic modal type for programmatic dismiss
type HTMLIonModalElement = HTMLElement & { dismiss: () => Promise<boolean> };

/**
 * Helper: upload a file, select target format, click convert, capture download.
 * Identical logic to real-conversions.spec.ts but extracted here for offline tests.
 */
/**
 * Select a format from the currently open Ionic modal.
 */
async function selectFormatFromModal(page: Page, formatLabel: string): Promise<void> {
  const modal = page.locator('ion-modal.show-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });

  const item = modal.locator('ion-item').filter({ hasText: formatLabel });
  await expect(item.first()).toBeVisible({ timeout: 10000 });

  await item.first().evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(300);

  if (await modal.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const m = document.querySelector('ion-modal.show-modal');
      if (m) (m as HTMLIonModalElement).dismiss();
    });
  }
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}

async function convertFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  sourceFormatLabel: string,
  targetFormatLabel: string
): Promise<string> {
  const fileInput = page.locator('app-file-picker input[type="file"]');

  // Use DataTransfer API to set files and dispatch a single change event
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

  await expect(page.getByText(file.name).first()).toBeVisible({ timeout: 10000 });

  // Wait for source format auto-detection via the reactive FormatSelectorComponent
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

  // Open target format modal
  await page
    .locator('app-format-selector .format-box')
    .nth(1)
    .evaluate((el: HTMLElement) => el.click());
  await selectFormatFromModal(page, targetFormatLabel);

  const convertButton = page.locator('ion-button.convert-button');
  await expect(convertButton).toBeEnabled({ timeout: 5000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await convertButton.click();

  const download = await downloadPromise;
  const downloadPath = await download.path();
  const fs = await import('fs');
  const downloadedContent = fs.readFileSync(downloadPath!);

  await expect(page.locator('ion-alert')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/conversion successful/i)).toBeVisible({ timeout: 30000 });

  await page.locator('ion-alert').getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('ion-alert')).not.toBeVisible({ timeout: 5000 });

  return downloadedContent.toString('utf-8');
}

/**
 * Wait for service worker to be fully activated and all assets cached.
 */
async function waitForServiceWorkerReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;

    // Wait for active worker
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return resolve();
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') resolve();
          });
        });
      });
    }

    // Give NGSW time to prefetch assets
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });
}

test.describe('EasyConverter - Offline Conversions E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // WebKit in Playwright doesn't reliably support Service Workers with setOffline
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Offline tests require Service Worker support (WebKit in Playwright lacks reliable SW)'
  );

  test.beforeEach(async ({ page }) => {
    // Load app online to let the service worker cache all assets
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });
    await waitForServiceWorkerReady(page);

    // Verify the app is loaded before going offline
    await expect(page.getByText('EasyConverter').first()).toBeVisible();
  });

  test('app shell loads offline after SW activation', async ({ page, context }) => {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });
  });

  test.describe('Text conversions offline', () => {
    const txtFile = {
      name: 'offline-sample.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Hello Offline World\nThis conversion runs without network.\nThird line here.'
      ),
    };

    test('TXT → Markdown offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, txtFile, 'Testo', 'Markdown');
      expect(output).toContain('Hello Offline World');
      expect(output).toContain('without network');
    });

    test('TXT → HTML offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, txtFile, 'Testo', 'HTML');
      expect(output).toContain('Hello Offline World');
      expect(output).toContain('<');
      expect(output).toContain('without network');
    });
  });

  test.describe('Markdown conversions offline', () => {
    const mdFile = {
      name: 'offline-doc.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Offline Heading\n\nA paragraph with **bold** and _italic_ text.\n\n- First\n- Second\n'
      ),
    };

    test('MD → TXT offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, mdFile, 'Markdown', 'Testo');
      expect(output).toContain('Offline Heading');
      expect(output).toContain('First');
      expect(output).toContain('Second');
    });

    test('MD → HTML offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, mdFile, 'Markdown', 'HTML');
      expect(output).toContain('<h1');
      expect(output).toContain('Offline Heading');
      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
    });
  });

  test.describe('HTML conversions offline', () => {
    const htmlFile = {
      name: 'offline-page.html',
      mimeType: 'text/html',
      buffer: Buffer.from(
        '<html><body><h1>Offline Test</h1><p>Content with <strong>bold</strong> formatting.</p></body></html>'
      ),
    };

    test('HTML → TXT offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, htmlFile, 'HTML', 'Testo');
      expect(output).toContain('Offline Test');
      expect(output).toContain('bold');
    });

    test('HTML → Markdown offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, htmlFile, 'HTML', 'Markdown');
      expect(output).toMatch(/# Offline Test|Offline Test\n=+/);
      expect(output).toContain('**bold**');
    });
  });

  test.describe('CSV → JSON offline', () => {
    test('CSV → JSON offline', async ({ page, context }) => {
      const csvFile = {
        name: 'offline-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('product,price,stock\nWidget,9.99,100\nGadget,24.50,42\n'),
      };

      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, csvFile, 'CSV', 'JSON');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].product).toBe('Widget');
      expect(parsed[0].price).toBe(9.99);
      expect(parsed[1].product).toBe('Gadget');
    });
  });

  test.describe('RTF conversions offline', () => {
    const rtfFile = {
      name: 'offline-doc.rtf',
      mimeType: 'application/rtf',
      buffer: Buffer.from(
        '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 Offline \\b bold text\\b0  and \\i italic text\\i0  in RTF.\\par End of document.}'
      ),
    };

    test('RTF → TXT offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, rtfFile, 'Rich Text', 'Testo');
      expect(output).toContain('Offline');
      expect(output).toContain('bold text');
      expect(output).toContain('italic text');
      expect(output).toContain('End of document');
    });

    test('RTF → HTML offline', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });

      const output = await convertFile(page, rtfFile, 'Rich Text', 'HTML');
      expect(output).toContain('<strong>bold text</strong>');
      expect(output).toContain('<em>italic text</em>');
      expect(output).toContain('Offline');
    });
  });
});
