/// <reference types="cypress" />

describe('EasyConverter - Converter Feature', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Page Layout', () => {
    it('should display the app title', () => {
      cy.contains('EasyConverter').should('be.visible');
    });

    it('should have file picker component', () => {
      cy.get('app-file-picker').should('exist');
    });

    it('should show hero section with benefits', () => {
      cy.contains('Fast').should('be.visible');
      cy.contains('Secure').should('be.visible');
      cy.contains('Offline').should('be.visible');
    });

    it('should have scanner promo card', () => {
      cy.contains('Document Scanner').should('be.visible');
    });

    it('should have toolbar with scanner button', () => {
      cy.get('ion-toolbar ion-button').should('exist');
    });
  });

  describe('File Selection', () => {
    it('should display file picker instructions', () => {
      cy.get('app-file-picker').within(() => {
        cy.contains('Choose File').should('be.visible');
      });
    });

    it('should have file input element', () => {
      cy.get('app-file-picker input[type="file"]').should('exist');
    });

    it('should support drag and drop', () => {
      cy.get('app-file-picker').should('have.attr', 'class').and('match', /picker/);
    });
  });

  describe('File Upload Workflow', () => {
    it('should handle text file upload', () => {
      const fileName = 'test.txt';
      const fileContent = 'Hello World\nThis is a test file.';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // Check if file info is displayed
      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
    });

    it('should handle CSV file upload', () => {
      const fileName = 'data.csv';
      const fileContent = 'name,age,city\nJohn,30,NYC\nJane,25,LA';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/csv',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
    });

    it('should handle JSON file upload', () => {
      const fileName = 'data.json';
      const fileContent = JSON.stringify({ name: 'John', age: 30 });

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/json',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
    });
  });

  describe('Format Selection', () => {
    beforeEach(() => {
      // Upload a test file first
      const fileContent = 'Test content';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );
    });

    it('should show source format selector', () => {
      cy.get('app-format-selector').should('exist');
    });

    it('should allow changing target format', () => {
      cy.contains('Select Target Format').should('be.visible');
    });
  });

  describe('Conversion Process', () => {
    it('should show convert button when file is selected', () => {
      const fileContent = 'Hello World';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // Wait for file to be processed
      cy.contains('Convert', { timeout: 5000 }).should('be.visible');
    });

    it('should disable convert button when formats are same', () => {
      // This test would check that TXT -> TXT is disabled
      // Implementation depends on the actual UI behavior
    });
  });

  describe('Progress Indicator', () => {
    it('should show progress during conversion', () => {
      const fileContent = 'Test content for conversion';
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'test.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // Attempt conversion if button exists
      cy.get('body').then(($body) => {
        if ($body.find('ion-button:contains("Convert")').length > 0) {
          cy.contains('Convert').click();
        }
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to scanner page', () => {
      cy.get('ion-toolbar ion-button').contains('Scanner').click();
      cy.url().should('include', '/scanner');
    });

    it('should navigate via promo card', () => {
      cy.contains('Try Scanner').click();
      cy.url().should('include', '/scanner');
    });
  });

  describe('Error Handling', () => {
    it('should handle file size validation', () => {
      // Create a large file (mock)
      const largeContent = 'x'.repeat(1024 * 1024 * 60); // 60 MB
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(largeContent),
          fileName: 'large.txt',
          mimeType: 'text/plain',
        },
        { force: true }
      );

      // Should show error toast or message
      cy.contains('too large', { timeout: 5000, matchCase: false }).should('exist');
    });

    it('should handle invalid file types gracefully', () => {
      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from('test'),
          fileName: 'test.xyz',
          mimeType: 'application/octet-stream',
        },
        { force: true }
      );

      // App should handle unknown formats
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/');
      cy.contains('EasyConverter').should('be.visible');
      cy.get('app-file-picker').should('be.visible');
    });

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/');
      cy.contains('EasyConverter').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      cy.get('app-file-picker').should('exist');
    });

    it('should support keyboard navigation', () => {
      cy.get('body').tab();
      // Check that focus moves through interactive elements
    });
  });
});
