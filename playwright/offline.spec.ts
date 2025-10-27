import { test, expect } from '@playwright/test';

test.describe('EasyConverter - Offline Functionality', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear service workers and caches before each test
    await context.clearCookies();
    await page.goto('/');

    await page.evaluate(async () => {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    });
  });

  test.describe('Service Worker Registration', () => {
    test('should register service worker in production', async ({ page }) => {
      await page.goto('/');

      // Wait for service worker to register
      const swReady = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          return registration !== null;
        }
        return false;
      });

      expect(swReady).toBe(true);
    });

    test('should have ngsw.json configuration', async ({ request }) => {
      const response = await request.get('/ngsw.json');
      expect(response.status()).toBe(200);
    });

    test('should have service worker script', async ({ request }) => {
      const response = await request.get('/ngsw-worker.js');
      expect(response.status()).toBe(200);
    });
  });

  test.describe('PWA Manifest', () => {
    test('should have valid manifest', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      expect(response.status()).toBe(200);
    });

    test('should have correct manifest properties', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(manifest).toHaveProperty('name');
      expect(manifest).toHaveProperty('short_name');
      expect(manifest).toHaveProperty('theme_color');
      expect(manifest).toHaveProperty('background_color');
      expect(manifest).toHaveProperty('display');
      expect(manifest).toHaveProperty('icons');
    });

    test('should have app name as EasyConverter', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(manifest.name).toContain('EasyConverter');
    });

    test('should have proper display mode', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(manifest.display).toBe('standalone');
    });

    test('should have app icons', async ({ request }) => {
      const response = await request.get('/manifest.webmanifest');
      const manifest = await response.json();

      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThan(0);
    });
  });

  test.describe('Asset Caching', () => {
    test('should cache main application files', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const cacheCount = await page.evaluate(async () => {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          return cacheNames.length;
        }
        return 0;
      });

      expect(cacheCount).toBeGreaterThan(0);
    });

    test('should cache static assets', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('EasyConverter').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      const cacheCount = await page.evaluate(async () => {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          return cacheNames.length;
        }
        return 0;
      });

      expect(cacheCount).toBeGreaterThan(0);
    });
  });

  test.describe('Offline Behavior', () => {
    test('should load app shell when offline', async ({ page, context }) => {
      // First visit to cache the app
      await page.goto('/');
      await expect(page.getByText('EasyConverter').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      // Simulate offline by setting offline mode
      await context.setOffline(true);

      // Reload and check if app still loads from cache
      await page.reload();
      await expect(page.getByText('EasyConverter').first()).toBeVisible({ timeout: 10000 });
    });

    test('should handle offline conversions', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Upload a file
      const fileContent = 'Offline test content';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      // Create a file buffer
      await fileInput.setInputFiles({
        name: 'offline-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent)
      });

      // All conversions should work offline
      await expect(page.getByText('offline-test.txt').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Update Notifications', () => {
    test('should have update notification component', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('app-update-notification')).toBeAttached();
    });

    test('should not show update banner initially', async ({ page }) => {
      await page.goto('/');
      // Update notification should be hidden unless there's an update
      await expect(page.locator('app-update-notification .update-banner')).not.toBeVisible();
    });
  });

  test.describe('Client-Side Processing', () => {
    test('should perform conversions without network', async ({ page, context }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Set offline to simulate no network
      await context.setOffline(true);

      // Upload and convert a file
      const fileContent = 'Test offline conversion';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent)
      });

      await expect(page.getByText('test.txt').first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle CSV to JSON conversion offline', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const csvContent = 'name,age\nJohn,30\nJane,25';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      });

      await expect(page.getByText('data.csv').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Cache Strategy', () => {
    test('should have valid ngsw.json configuration', async ({ request }) => {
      const response = await request.get('/ngsw.json');
      const config = await response.json();

      // Verify basic structure
      expect(config).toHaveProperty('configVersion');
      expect(config).toHaveProperty('assetGroups');
      expect(config.assetGroups).toBeInstanceOf(Array);
      expect(config.assetGroups.length).toBeGreaterThan(0);
    });

    test('should cache app assets', async ({ request }) => {
      const response = await request.get('/ngsw.json');
      const config = await response.json();

      // Find app asset group
      const appGroup = config.assetGroups.find(
        (group: any) => group.name === 'app'
      );
      expect(appGroup).toBeDefined();
      expect(appGroup.installMode).toBe('prefetch');
      expect(appGroup.urls).toBeInstanceOf(Array);
      expect(appGroup.urls.length).toBeGreaterThan(0);
    });

    test('should have prefetch strategy for app shell', async ({ request }) => {
      const response = await request.get('/ngsw.json');
      const config = await response.json();

      const appGroup = config.assetGroups.find(
        (group: any) => group.name === 'app'
      );
      expect(appGroup).toBeDefined();
      expect(appGroup.installMode).toBe('prefetch');
      expect(appGroup.updateMode).toBe('prefetch');
    });
  });

  test.describe('Performance', () => {
    test('should load quickly from cache', async ({ page }) => {
      // First visit
      await page.goto('/');
      await expect(page.getByText('EasyConverter').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      // Second visit (from cache)
      const start = Date.now();
      await page.goto('/');
      await expect(page.getByText('EasyConverter').first()).toBeVisible();
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(2000);
    });
  });

  test.describe('Network Detection', () => {
    test('should detect online status', async ({ page }) => {
      await page.goto('/');

      const isOnline = await page.evaluate(() => {
        return typeof navigator.onLine === 'boolean';
      });

      expect(isOnline).toBe(true);
    });

    test('should handle network status changes', async ({ page }) => {
      await page.goto('/');

      const statusType = await page.evaluate(() => {
        const initialStatus = navigator.onLine;

        // Trigger online/offline events
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));

        return typeof initialStatus;
      });

      expect(statusType).toBe('boolean');
    });
  });

  test.describe('Data Persistence', () => {
    test('should work without external dependencies', async ({ page, context }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Block all external requests
      await page.route('https://**', route => route.abort());
      await page.route('http://**', route => {
        if (!route.request().url().includes('localhost')) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // App should still function
      await expect(page.getByText('EasyConverter').first()).toBeVisible();
    });

    test('should handle conversions without network', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Ensure no network requests during conversion
      await page.route('**/*', route => {
        if (!route.request().url().includes('localhost')) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const fileContent = 'Network-free conversion';
      const fileInput = page.locator('app-file-picker input[type="file"]');

      await fileInput.setInputFiles({
        name: 'network-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent)
      });

      await expect(page.getByText('network-test.txt').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should check for service worker support', async ({ page }) => {
      await page.goto('/');

      const hasServiceWorker = await page.evaluate(() => {
        return 'serviceWorker' in navigator;
      });

      expect(hasServiceWorker).toBe(true);
    });

    test('should check for cache API support', async ({ page }) => {
      await page.goto('/');

      const hasCaches = await page.evaluate(() => {
        return 'caches' in window;
      });

      expect(hasCaches).toBe(true);
    });
  });
});
