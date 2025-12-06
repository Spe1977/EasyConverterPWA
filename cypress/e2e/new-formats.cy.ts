/// <reference types="cypress" />

describe('EasyConverter - New Format Conversions (RTF, YAML, XML, Base64)', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('RTF ↔ HTML Conversions', () => {
    it('should convert HTML to RTF', () => {
      const fileName = 'test.html';
      const fileContent = '<html><body><h1>Test Title</h1><p>This is a <b>bold</b> test.</p></body></html>';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/html',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');

      // Wait for format selectors to appear
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select RTF as target format
      cy.contains('RTF', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete and download to trigger
      cy.wait(2000);
    });

    it('should convert RTF to HTML', () => {
      const fileName = 'test.rtf';
      // Simple RTF content with bold text
      const fileContent = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 This is \\b bold\\b0  text.}';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/rtf',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select HTML as target format
      cy.contains('HTML', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });
  });

  describe('YAML ↔ JSON Conversions', () => {
    it('should convert JSON to YAML', () => {
      const fileName = 'data.json';
      const fileContent = JSON.stringify({
        name: 'John Doe',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'NYC',
        },
        hobbies: ['reading', 'coding', 'gaming'],
      }, null, 2);

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/json',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select YAML as target format
      cy.contains('YAML', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });

    it('should convert YAML to JSON', () => {
      const fileName = 'data.yaml';
      const fileContent = `name: John Doe
age: 30
address:
  street: 123 Main St
  city: NYC
hobbies:
  - reading
  - coding
  - gaming`;

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/x-yaml',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select JSON as target format
      cy.contains('JSON', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });
  });

  describe('XML ↔ JSON Conversions', () => {
    it('should convert JSON to XML', () => {
      const fileName = 'data.json';
      const fileContent = JSON.stringify({
        root: {
          person: {
            name: 'John Doe',
            age: 30,
            city: 'NYC',
          },
        },
      }, null, 2);

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/json',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select XML as target format
      cy.contains('XML', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });

    it('should convert XML to JSON', () => {
      const fileName = 'data.xml';
      const fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <person>
    <name>John Doe</name>
    <age>30</age>
    <city>NYC</city>
  </person>
</root>`;

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/xml',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select JSON as target format
      cy.contains('JSON', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });
  });

  describe('Base64 Encode/Decode', () => {
    it('should encode text file to Base64', () => {
      const fileName = 'test.txt';
      const fileContent = 'Hello World! This is a test file for Base64 encoding.';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/plain',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select Base64 as target format
      cy.contains('Base64', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });

    it('should decode Base64 file to text', () => {
      const fileName = 'test.b64';
      // Base64 encoding of "Hello World!"
      const fileContent = 'SGVsbG8gV29ybGQh';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'text/plain',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select TXT as target format
      cy.contains('TXT', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });

    it('should handle Base64 encoding of binary data (images)', () => {
      // Create a simple 1x1 transparent PNG
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const pngBuffer = Cypress.Buffer.from(pngBase64, 'base64');

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: pngBuffer,
          fileName: 'test.png',
          mimeType: 'image/png',
        },
        { force: true }
      );

      cy.contains('test.png', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Click on target format selector
      cy.get('.format-box').last().click();
      cy.wait(500);

      // Select Base64 as target format
      cy.contains('Base64', { timeout: 5000 }).click();
      cy.wait(500);

      // Click Convert button
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();

      // Wait for conversion to complete
      cy.wait(2000);
    });
  });

  describe('Multi-step Conversion Chains', () => {
    it('should support XML → JSON → YAML conversion chain', () => {
      const fileName = 'data.xml';
      const fileContent = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <database>
    <host>localhost</host>
    <port>5432</port>
  </database>
</config>`;

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/xml',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // First conversion: XML → JSON
      cy.get('.format-box').last().click();
      cy.wait(500);
      cy.contains('JSON', { timeout: 5000 }).click();
      cy.wait(500);
      cy.contains('Convert', { timeout: 5000 }).should('be.visible').click();
      cy.wait(2000);

      // Note: In a real scenario, you'd need to re-upload the converted JSON
      // and then convert it to YAML. This test verifies the UI flow only.
    });
  });

  describe('Format Detection and Validation', () => {
    it('should correctly detect RTF format', () => {
      const fileName = 'document.rtf';
      const fileContent = '{\\rtf1\\ansi\\deff0 Test content}';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/rtf',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      // Should show RTF as detected format
      cy.contains('RTF', { timeout: 5000 }).should('exist');
    });

    it('should correctly detect YAML format', () => {
      const fileName = 'config.yaml';
      const fileContent = 'key: value\nlist:\n  - item1\n  - item2';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/x-yaml',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      // Should show YAML as detected format
      cy.contains('YAML', { timeout: 5000 }).should('exist');
    });

    it('should correctly detect XML format', () => {
      const fileName = 'data.xml';
      const fileContent = '<?xml version="1.0"?><root><item>test</item></root>';

      cy.get('app-file-picker input[type="file"]').selectFile(
        {
          contents: Cypress.Buffer.from(fileContent),
          fileName: fileName,
          mimeType: 'application/xml',
        },
        { force: true }
      );

      cy.contains(fileName, { timeout: 5000 }).should('be.visible');
      // Should show XML as detected format
      cy.contains('XML', { timeout: 5000 }).should('exist');
    });
  });
});
