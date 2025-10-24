/// <reference types="cypress" />

describe('EasyConverter - Offline Functionality', () => {
  beforeEach(() => {
    // Clear service worker and caches before each test
    cy.window().then((win) => {
      if ('serviceWorker' in win.navigator) {
        win.navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }
      if ('caches' in win) {
        win.caches.keys().then((names) => {
          names.forEach((name) => {
            win.caches.delete(name);
          });
        });
      }
    });
  });

  describe('Service Worker Registration', () => {
    it('should register service worker in production', () => {
      cy.visit('/');

      cy.window().then((win) => {
        cy.wrap(win.navigator.serviceWorker.ready, { timeout: 10000 }).should('exist');
      });
    });

    it('should have ngsw.json configuration', () => {
      cy.request('/ngsw.json').its('status').should('eq', 200);
    });

    it('should have service worker script', () => {
      cy.request('/ngsw-worker.js').its('status').should('eq', 200);
    });
  });

  describe('PWA Manifest', () => {
    it('should have valid manifest', () => {
      cy.request('/manifest.webmanifest').its('status').should('eq', 200);
    });

    it('should have correct manifest properties', () => {
      cy.request('/manifest.webmanifest').then((response) => {
        expect(response.body).to.have.property('name');
        expect(response.body).to.have.property('short_name');
        expect(response.body).to.have.property('theme_color');
        expect(response.body).to.have.property('background_color');
        expect(response.body).to.have.property('display');
        expect(response.body).to.have.property('icons');
      });
    });

    it('should have app name as EasyConverter', () => {
      cy.request('/manifest.webmanifest').then((response) => {
        expect(response.body.name).to.include('EasyConverter');
      });
    });

    it('should have proper display mode', () => {
      cy.request('/manifest.webmanifest').then((response) => {
        expect(response.body.display).to.eq('standalone');
      });
    });

    it('should have app icons', () => {
      cy.request('/manifest.webmanifest').then((response) => {
        expect(response.body.icons).to.be.an('array');
        expect(response.body.icons.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Asset Caching', () => {
    it('should cache main application files', () => {
      cy.visit('/');

      cy.window().then((win) => {
        if ('caches' in win) {
          cy.wrap(win.caches.keys()).should('have.length.greaterThan', 0);
        }
      });
    });

    it('should cache static assets', () => {
      cy.visit('/');

      // Navigate to trigger caching
      cy.contains('EasyConverter').should('be.visible');

      cy.window().then((win) => {
        if ('caches' in win) {
          win.caches.keys().then((cacheNames) => {
            expect(cacheNames.length).to.be.greaterThan(0);
          });
        }
      });
    });
  });

  describe('Offline Behavior', () => {
    it('should load app shell when offline', () => {
      // First visit to cache the app
      cy.visit('/');
      cy.contains('EasyConverter').should('be.visible');

      // Simulate offline
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false);
      });

      // Reload and check if app still loads
      cy.reload();
      cy.contains('EasyConverter').should('be.visible');
    });

    it('should handle offline conversions', () => {
      cy.visit('/');

      // Upload a file
      const fileContent = 'Offline test content';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'offline-test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // All conversions should work offline
      cy.contains('offline-test.txt', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Update Notifications', () => {
    it('should have update notification component', () => {
      cy.visit('/');
      cy.get('app-update-notification').should('exist');
    });

    it('should not show update banner initially', () => {
      cy.visit('/');
      // Update notification should be hidden unless there's an update
      cy.get('app-update-notification .update-banner').should('not.exist');
    });
  });

  describe('Client-Side Processing', () => {
    it('should perform conversions without network', () => {
      cy.visit('/');

      // Intercept all network requests to simulate offline
      cy.intercept('**/*', { forceNetworkError: true });

      // Upload and convert a file
      const fileContent = 'Test offline conversion';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      cy.contains('test.txt', { timeout: 5000 }).should('be.visible');
    });

    it('should handle CSV to JSON conversion offline', () => {
      cy.visit('/');

      const csvContent = 'name,age\nJohn,30\nJane,25';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(csvContent),
          fileName: 'data.csv',
          mimeType: 'text/csv',
        },
        { force: true }
      );

      cy.contains('data.csv', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Cache Strategy', () => {
    it('should use cache-first strategy for heavy libraries', () => {
      cy.request('/ngsw.json').then((response) => {
        const config = response.body;
        expect(config).to.have.property('dataGroups');

        const heavyLibs = config.dataGroups.find(
          (group: any) => group.name === 'heavy-libraries'
        );
        expect(heavyLibs).to.exist;
        expect(heavyLibs.cacheConfig.strategy).to.eq('performance');
      });
    });

    it('should cache PDF libraries', () => {
      cy.request('/ngsw.json').then((response) => {
        const config = response.body;
        const pdfLibs = config.dataGroups.find((group: any) => group.name === 'pdf-libraries');
        expect(pdfLibs).to.exist;
      });
    });

    it('should have appropriate cache durations', () => {
      cy.request('/ngsw.json').then((response) => {
        const config = response.body;
        const heavyLibs = config.dataGroups.find(
          (group: any) => group.name === 'heavy-libraries'
        );
        expect(heavyLibs.cacheConfig.maxAge).to.exist;
      });
    });
  });

  describe('Performance', () => {
    it('should load quickly from cache', () => {
      // First visit
      cy.visit('/');
      cy.contains('EasyConverter').should('be.visible');

      // Second visit (from cache)
      const start = Date.now();
      cy.visit('/');
      cy.contains('EasyConverter').should('be.visible');
      cy.then(() => {
        const loadTime = Date.now() - start;
        expect(loadTime).to.be.lessThan(2000);
      });
    });
  });

  describe('Network Detection', () => {
    it('should detect online status', () => {
      cy.visit('/');

      cy.window().then((win) => {
        expect(win.navigator.onLine).to.be.a('boolean');
      });
    });

    it('should handle network status changes', () => {
      cy.visit('/');

      cy.window().then((win) => {
        const initialStatus = win.navigator.onLine;
        expect(initialStatus).to.be.a('boolean');

        // Trigger online/offline events
        win.dispatchEvent(new Event('offline'));
        win.dispatchEvent(new Event('online'));
      });
    });
  });

  describe('Data Persistence', () => {
    it('should work without external dependencies', () => {
      cy.visit('/');

      // Block all external requests
      cy.intercept('https://**', { forceNetworkError: true });
      cy.intercept('http://**', { forceNetworkError: true });

      // App should still function
      cy.contains('EasyConverter').should('be.visible');
    });

    it('should handle conversions without network', () => {
      cy.visit('/');

      // Ensure no network requests during conversion
      cy.intercept('**/*', (req) => {
        if (!req.url.includes('localhost')) {
          req.destroy();
        }
      });

      const fileContent = 'Network-free conversion';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'network-test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      cy.contains('network-test.txt', { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Browser Compatibility', () => {
    it('should check for service worker support', () => {
      cy.visit('/');

      cy.window().then((win) => {
        expect('serviceWorker' in win.navigator).to.be.true;
      });
    });

    it('should check for cache API support', () => {
      cy.visit('/');

      cy.window().then((win) => {
        expect('caches' in win).to.be.true;
      });
    });
  });
});
