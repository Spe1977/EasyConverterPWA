import { TestBed } from '@angular/core/testing';
import { ConverterService } from './converter.service';
import { PdfService } from './pdf.service';
import { ImageService } from './image.service';
import { EpubService } from './epub.service';
import { RtfService } from './rtf.service';
import { ConversionFormat } from '../models/conversion-format';
import JSZip from 'jszip';

describe('ConverterService', () => {
  let service: ConverterService;
  let pdfServiceSpy: jasmine.SpyObj<PdfService>;
  let imageServiceSpy: jasmine.SpyObj<ImageService>;

  beforeEach(() => {
    // Create spy objects for dependencies
    const pdfSpy = jasmine.createSpyObj('PdfService', [
      'createPdfFromText',
      'createPdfFromImage',
      'createPdfFromHtml',
      'extractTextFromPdf',
      'convertPdfPageToImage',
    ]);
    const imageSpy = jasmine.createSpyObj('ImageService', ['convertImage']);

    TestBed.configureTestingModule({
      providers: [
        ConverterService,
        { provide: PdfService, useValue: pdfSpy },
        { provide: ImageService, useValue: imageSpy },
      ],
    });

    service = TestBed.inject(ConverterService);
    pdfServiceSpy = TestBed.inject(PdfService) as jasmine.SpyObj<PdfService>;
    imageServiceSpy = TestBed.inject(ImageService) as jasmine.SpyObj<ImageService>;
    pdfServiceSpy.extractTextFromPdf.and.resolveTo('Extracted PDF text for validation');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Format Detection', () => {
    it('should detect TXT format', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.TXT);
    });

    it('should detect MD format', () => {
      const file = new File(['# Title'], 'test.md', { type: 'text/markdown' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.MD);
    });

    it('should detect HTML format', () => {
      const file = new File(['<html></html>'], 'test.html', { type: 'text/html' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.HTML);
    });

    it('should detect CSV format', () => {
      const file = new File(['a,b,c'], 'test.csv', { type: 'text/csv' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.CSV);
    });

    it('should detect JSON format', () => {
      const file = new File(['{}'], 'test.json', { type: 'application/json' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.JSON);
    });

    it('should detect PDF format', () => {
      const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.PDF);
    });

    it('should detect PNG format', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.PNG);
    });

    it('should detect JPEG format', () => {
      const file = new File([''], 'test.jpeg', { type: 'image/jpeg' });
      expect(service.detectFormat(file)).toBe(ConversionFormat.JPEG);
    });

    it('should return null for unknown format', () => {
      const file = new File([''], 'test.unknown', { type: 'application/octet-stream' });
      expect(service.detectFormat(file)).toBeNull();
    });

    it('should detect JSON content even when extension is TXT', async () => {
      const file = new File(['{"name":"EasyConverter"}'], 'test.txt', { type: 'text/plain' });

      await expectAsync(service.detectFormatFromContent(file)).toBeResolvedTo(
        ConversionFormat.JSON
      );
    });

    it('should detect HTML content even when extension is XML', async () => {
      const file = new File(['<!DOCTYPE html><html><body><p>Hello</p></body></html>'], 'test.xml', {
        type: 'application/xml',
      });

      await expectAsync(service.detectFormatFromContent(file)).toBeResolvedTo(
        ConversionFormat.HTML
      );
    });

    it('should detect XML content even when extension is TXT', async () => {
      const file = new File(['<?xml version="1.0"?><note><to>You</to></note>'], 'test.txt', {
        type: 'text/plain',
      });

      await expectAsync(service.detectFormatFromContent(file)).toBeResolvedTo(ConversionFormat.XML);
    });

    it('should detect CSV content even when extension is TXT', async () => {
      const file = new File(['name,age\nAda,36\nLinus,55'], 'test.txt', { type: 'text/plain' });

      await expectAsync(service.detectFormatFromContent(file)).toBeResolvedTo(ConversionFormat.CSV);
    });
  });

  describe('Available Target Formats', () => {
    it('should return available formats for TXT', () => {
      const formats = service.getAvailableTargetFormats(ConversionFormat.TXT);
      expect(formats).toContain(ConversionFormat.MD);
      expect(formats).toContain(ConversionFormat.HTML);
      expect(formats).toContain(ConversionFormat.PDF);
      expect(formats).not.toContain(ConversionFormat.TXT);
    });

    it('should return available formats for CSV', () => {
      const formats = service.getAvailableTargetFormats(ConversionFormat.CSV);
      expect(formats).toContain(ConversionFormat.JSON);
      expect(formats).toContain(ConversionFormat.XLSX);
      expect(formats).toContain(ConversionFormat.HTML);
      expect(formats).not.toContain(ConversionFormat.CSV);
    });

    it('should return available formats for PNG', () => {
      const formats = service.getAvailableTargetFormats(ConversionFormat.PNG);
      expect(formats).toContain(ConversionFormat.JPEG);
      expect(formats).toContain(ConversionFormat.WEBP);
      expect(formats).toContain(ConversionFormat.PDF);
      expect(formats).not.toContain(ConversionFormat.PNG);
    });

    it('should return available formats for PDF', () => {
      const formats = service.getAvailableTargetFormats(ConversionFormat.PDF);
      expect(formats).toContain(ConversionFormat.TXT);
      expect(formats).toContain(ConversionFormat.PNG);
      expect(formats).toContain(ConversionFormat.JPEG);
      expect(formats).not.toContain(ConversionFormat.PDF);
    });

    it('should expose structured export targets for HTML and XML', () => {
      const htmlTargets = service.getAvailableTargetFormats(ConversionFormat.HTML);
      const xmlTargets = service.getAvailableTargetFormats(ConversionFormat.XML);

      expect(htmlTargets).toContain(ConversionFormat.CSV);
      expect(htmlTargets).toContain(ConversionFormat.XLSX);
      expect(xmlTargets).toContain(ConversionFormat.CSV);
      expect(xmlTargets).toContain(ConversionFormat.XLSX);
      expect(xmlTargets).toContain(ConversionFormat.HTML);
    });

    it('should expose conversion reliability metadata for supported conversions', () => {
      const support = service.getConversionSupport(ConversionFormat.JSON, ConversionFormat.CSV);

      expect(support).not.toBeNull();
      expect(support?.reliability).toBe('requires-uniform-data');
    });

    it('should expose target supports with reliability metadata', () => {
      const supports = service.getAvailableTargetSupports(ConversionFormat.CSV);
      const htmlSupport = supports.find((item) => item.target === ConversionFormat.HTML);

      expect(htmlSupport?.reliability).toBe('table-only');
    });

    it('should block requires-uniform-data conversions for non-uniform JSON arrays', async () => {
      const file = new File(
        [
          JSON.stringify([
            { name: 'Ada', age: 36 },
            { name: 'Linus', city: 'Helsinki' },
          ]),
        ],
        'test.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.JSON_UNIFORM_KEYS_REQUIRED',
        })
      );
    });

    it('should warn but allow table-only conversions', async () => {
      const file = new File(['name,age\nAda,36'], 'test.csv', { type: 'text/csv' });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.CSV, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.TABLE_ONLY',
        })
      );
    });

    it('should warn when HTML tables are converted to flattened formats', async () => {
      const file = new File(
        ['<table><tr><th>Name</th></tr><tr><td>Ada</td></tr></table>'],
        'table.html',
        { type: 'text/html' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.TXT)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_COMPLEXITY',
        })
      );
    });

    it('should block HTML to CSV when no real table is present', async () => {
      const file = new File(['<article><p>No table here</p></article>'], 'page.html', {
        type: 'text/html',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_REQUIRED',
        })
      );
    });

    it('should warn but allow HTML tabular export when merged cells are present', async () => {
      const file = new File(
        [
          `<table>
            <tr><th colspan="2">Person</th></tr>
            <tr><td>Ada</td><td>36</td></tr>
          </table>`,
        ],
        'merged-table.html',
        { type: 'text/html' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_MERGED_CELLS',
        })
      );
    });

    it('should warn but allow HTML tabular export when nested tables are present', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Details</th></tr>
            <tr><td>Ada</td><td><table><tr><td>Age</td><td>36</td></tr></table></td></tr>
          </table>`,
        ],
        'nested-table.html',
        { type: 'text/html' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_NESTED',
        })
      );
    });

    it('should block HTML tabular export when table has only headers and no data rows', async () => {
      const file = new File(
        [
          `<table>
            <thead><tr><th>Name</th><th>Age</th></tr></thead>
            <tbody></tbody>
          </table>`,
        ],
        'header-only.html',
        { type: 'text/html' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_REQUIRED',
        })
      );
    });

    it('should warn when JSON tabular export needs controlled flattening', async () => {
      const file = new File(
        [
          JSON.stringify([
            { id: 1, profile: { name: 'Ada', city: 'London' } },
            { id: 2, profile: { name: 'Linus', city: 'Helsinki' } },
          ]),
        ],
        'nested.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );
    });

    it('should block XML tabular export when normalized rows are not uniform', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <items>
              <item>
                <profile>
                  <name>Ada</name>
                </profile>
              </item>
              <item>
                <profile>
                  <city>Helsinki</city>
                </profile>
              </item>
            </items>
          </root>`,
        ],
        'nested.xml',
        { type: 'application/xml' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_TABULAR_DATA_REQUIRED',
        })
      );
    });

    it('should block invalid XML for CSV, XLSX and HTML tabular exports', async () => {
      const file = new File(['<root><item>broken</root>'], 'invalid.xml', {
        type: 'application/xml',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.INVALID_XML',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.XLSX)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.INVALID_XML',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.INVALID_XML',
        })
      );
    });

    it('should block blank HTML tabular exports when no usable table is present', async () => {
      const file = new File(['   <div>   </div>   '], 'blank.html', {
        type: 'text/html',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.HTML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.HTML_TABLE_REQUIRED',
        })
      );
    });

    it('should block blank JSON tabular exports as invalid JSON', async () => {
      const file = new File(['   '], 'blank.json', {
        type: 'application/json',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.INVALID_JSON',
        })
      );
    });

    it('should warn but allow empty JSON arrays for tabular exports', async () => {
      const file = new File(['[]'], 'empty-array.json', {
        type: 'application/json',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.REQUIRES_UNIFORM_DATA',
        })
      );
    });

    it('should block blank XML tabular exports as invalid XML', async () => {
      const file = new File(['   '], 'blank.xml', {
        type: 'application/xml',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.INVALID_XML',
        })
      );
    });

    it('should block PDF text extraction when no text is available', async () => {
      pdfServiceSpy.extractTextFromPdf.and.resolveTo('');
      const file = new File(['pdf'], 'scan.pdf', { type: 'application/pdf' });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.PDF, ConversionFormat.TXT)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.PDF_TEXT_REQUIRED',
        })
      );
    });

    it('should warn on fragile multi-step conversions', async () => {
      const file = new File(['{\\rtf1\\ansi Hello world}'], 'test.rtf', {
        type: 'application/rtf',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.RTF, ConversionFormat.PDF)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.MULTI_STEP_REVIEW',
        })
      );
    });
  });

  describe('TXT Conversions', () => {
    it('should convert HTML table to CSV', async () => {
      const file = new File(
        ['<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr></table>'],
        'table.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe('text/csv');
      expect(csvText).toContain('Name,Age');
      expect(csvText).toContain('Ada,36');
    });

    it('should convert TXT to MD', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/markdown');
      expect(result.fileName).toBe('test.md');
    });

    it('should convert TXT to HTML', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/html');
      expect(result.fileName).toBe('test.html');
    });

    it('should convert TXT to PDF', async () => {
      const mockPdfBytes = new Uint8Array([1, 2, 3]);
      pdfServiceSpy.createPdfFromText.and.returnValue(Promise.resolve(mockPdfBytes));

      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.PDF);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileName).toBe('test.pdf');
      expect(pdfServiceSpy.createPdfFromText).toHaveBeenCalled();
    });
  });

  describe('Markdown Conversions', () => {
    it('should convert MD to HTML', async () => {
      const file = new File(['# Hello World'], 'test.md', { type: 'text/markdown' });
      const result = await service.convert(file, ConversionFormat.MD, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/html');
      expect(result.fileName).toBe('test.html');
    });

    it('should convert MD to TXT', async () => {
      const file = new File(['# Hello World'], 'test.md', { type: 'text/markdown' });
      const result = await service.convert(file, ConversionFormat.MD, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/plain');
      expect(result.fileName).toBe('test.txt');
    });
  });

  describe('HTML Conversions', () => {
    it('should convert HTML table to XLSX with expected headers and values', async () => {
      const file = new File(
        ['<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr></table>'],
        'table.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxBuffer = await result.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('table.xlsx');
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(sheet['A1'].v).toBe('Name');
      expect(sheet['B1'].v).toBe('Age');
      expect(sheet['A2'].v).toBe('Ada');
      expect(sheet['B2'].v).toBe('36');
    });

    it('should fall back to main-thread XLSX processing when Worker is unavailable', async () => {
      const file = new File(
        ['<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr></table>'],
        'table.html',
        { type: 'text/html' }
      );
      const originalWorker = globalThis.Worker;

      try {
        (globalThis as { Worker?: typeof Worker }).Worker = undefined;

        const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
        const xlsxBuffer = await result.blob?.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        expect(result.success).toBeTrue();
        expect(sheet['A1'].v).toBe('Name');
        expect(sheet['B2'].v).toBe('36');
      } finally {
        (globalThis as { Worker?: typeof Worker }).Worker = originalWorker;
      }
    });

    it('should convert HTML tables with merged header cells to CSV and XLSX without dropping columns', async () => {
      const file = new File(
        [
          `<table>
            <tr><th colspan="2">Person</th></tr>
            <tr><td>Ada</td><td>36</td></tr>
          </table>`,
        ],
        'merged-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toBe('Person,Person_2\r\nAda,36');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('Person');
      expect(sheet['B1'].v).toBe('Person_2');
      expect(sheet['A2'].v).toBe('Ada');
      expect(sheet['B2'].v).toBe('36');
    });

    it('should keep alignment when HTML tables contain rowspans in body rows', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Role</th><th>Score</th></tr>
            <tr><td rowspan="2">Ada</td><td>Math</td><td>99</td></tr>
            <tr><td>Logic</td><td>100</td></tr>
          </table>`,
        ],
        'rowspan-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toBe('Name,Role,Score\r\nAda,Math,99\r\n,Logic,100');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('Name');
      expect(sheet['B1'].v).toBe('Role');
      expect(sheet['C1'].v).toBe('Score');
      expect(sheet['A2'].v).toBe('Ada');
      expect(sheet['B2'].v).toBe('Math');
      expect(sheet['C2'].v).toBe('99');
      expect(sheet['A3'].v).toBe('');
      expect(sheet['B3'].v).toBe('Logic');
      expect(sheet['C3'].v).toBe('100');
    });

    it('should fallback to generated column names when HTML table has no th cells', async () => {
      const file = new File(
        ['<table><tr><td>Ada</td><td>36</td></tr><tr><td>Linus</td><td>55</td></tr></table>'],
        'no-header-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain('column_1,column_2');
      expect(csvText).toContain('Ada,36');
      expect(csvText).toContain('Linus,55');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('column_1');
      expect(sheet['B1'].v).toBe('column_2');
      expect(sheet['A2'].v).toBe('Ada');
      expect(sheet['B2'].v).toBe('36');
      expect(sheet['A3'].v).toBe('Linus');
      expect(sheet['B3'].v).toBe('55');
    });

    it('should export only the first HTML table when multiple tables are present', async () => {
      const file = new File(
        [
          `<section>
            <table>
              <tr><th>Name</th><th>Age</th></tr>
              <tr><td>Ada</td><td>36</td></tr>
            </table>
            <table>
              <tr><th>Name</th><th>Age</th></tr>
              <tr><td>Linus</td><td>55</td></tr>
            </table>
          </section>`,
        ],
        'multi-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain('Name,Age');
      expect(csvText).toContain('Ada,36');
      expect(csvText).not.toContain('Linus,55');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('Name');
      expect(sheet['B1'].v).toBe('Age');
      expect(sheet['A2'].v).toBe('Ada');
      expect(sheet['B2'].v).toBe('36');
      expect(sheet['A3']).toBeUndefined();
      expect(sheet['B3']).toBeUndefined();
    });

    it('should escape commas and quotes from HTML cells while normalizing newlines to spaces in CSV export', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Notes</th></tr>
            <tr><td>Ada</td><td>Hello, "world"
line two</td></tr>
          </table>`,
        ],
        'escaped-cells.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe('text/csv');
      expect(csvText).toBe('Name,Notes\r\nAda,"Hello, ""world"" line two"');
    });

    it('should neutralize formula-like cells in HTML to CSV export', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Payload</th></tr>
            <tr><td>Ada</td><td>=cmd|' /C calc'!A0</td></tr>
          </table>`,
        ],
        'formula-table.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(csvText).toContain(`Ada,'=cmd|' /C calc'!A0`);
    });

    it('should extract only outer table rows when nested tables are present', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Details</th></tr>
            <tr><td>Ada</td><td><table><tr><td>Age</td><td>36</td></tr></table></td></tr>
            <tr><td>Linus</td><td>Coder</td></tr>
          </table>`,
        ],
        'nested-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();

      expect(csvResult.success).toBeTrue();
      const csvLines = csvText!.split('\r\n');
      expect(csvLines[0]).toBe('Name,Details');
      expect(csvLines[1]).toBe('Ada,');
      expect(csvLines[2]).toBe('Linus,Coder');
      expect(csvLines.length).toBe(3);
    });

    it('should use thead rows as headers even when they use td instead of th', async () => {
      const file = new File(
        [
          `<table>
            <thead><tr><td>Name</td><td>Age</td></tr></thead>
            <tbody>
              <tr><td>Ada</td><td>36</td></tr>
              <tr><td>Linus</td><td>54</td></tr>
            </tbody>
          </table>`,
        ],
        'thead-td.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();

      expect(csvResult.success).toBeTrue();
      const csvLines = csvText!.split('\r\n');
      expect(csvLines[0]).toBe('Name,Age');
      expect(csvLines[1]).toBe('Ada,36');
      expect(csvLines[2]).toBe('Linus,54');
      expect(csvLines.length).toBe(3);
    });

    it('should exclude tfoot rows from data export', async () => {
      const file = new File(
        [
          `<table>
            <thead><tr><th>Item</th><th>Price</th></tr></thead>
            <tbody>
              <tr><td>Book</td><td>10</td></tr>
              <tr><td>Pen</td><td>2</td></tr>
            </tbody>
            <tfoot><tr><td>Total</td><td>12</td></tr></tfoot>
          </table>`,
        ],
        'tfoot-table.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();

      expect(csvResult.success).toBeTrue();
      const csvLines = csvText!.split('\r\n');
      expect(csvLines[0]).toBe('Item,Price');
      expect(csvLines[1]).toBe('Book,10');
      expect(csvLines[2]).toBe('Pen,2');
      expect(csvLines.length).toBe(3);
    });

    it('should handle thead/tbody structure correctly in XLSX export', async () => {
      const file = new File(
        [
          `<table>
            <thead><tr><th>Name</th><th>Age</th></tr></thead>
            <tbody>
              <tr><td>Ada</td><td>36</td></tr>
            </tbody>
          </table>`,
        ],
        'thead-tbody.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const xlsxLib = await import('xlsx');
      const buffer = await result.blob!.arrayBuffer();
      const wb = xlsxLib.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      expect(ws['A1']?.v).toBe('Name');
      expect(ws['B1']?.v).toBe('Age');
      expect(ws['A2']?.v).toBe('Ada');
      expect(ws['B2']?.v).toBe('36');
    });

    it('should neutralize formula-like cells in HTML to XLSX export', async () => {
      const file = new File(
        [
          `<table>
            <tr><th>Name</th><th>Payload</th></tr>
            <tr><td>Ada</td><td>@SUM(1,1)</td></tr>
          </table>`,
        ],
        'formula-table.xlsx.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.XLSX);
      const xlsxLib = await import('xlsx');
      const buffer = await result.blob!.arrayBuffer();
      const wb = xlsxLib.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];

      expect(result.success).toBeTrue();
      expect(ws['B2']?.v).toBe("'@SUM(1,1)");
    });

    it('should fail conversion when table has only headers and no data rows', async () => {
      const file = new File(
        [
          `<table>
            <thead><tr><th>Name</th><th>Age</th></tr></thead>
            <tbody></tbody>
          </table>`,
        ],
        'header-only.html',
        { type: 'text/html' }
      );

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      expect(result.success).toBeFalse();
    });

    it('should handle multi-row thead as header block in CSV export', async () => {
      const file = new File(
        [
          `<table>
            <thead>
              <tr><th colspan="2">Person</th></tr>
              <tr><th>Name</th><th>Age</th></tr>
            </thead>
            <tbody>
              <tr><td>Ada</td><td>36</td></tr>
            </tbody>
          </table>`,
        ],
        'multi-row-thead.html',
        { type: 'text/html' }
      );

      const csvResult = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();

      expect(csvResult.success).toBeTrue();
      const csvLines = csvText!.split('\r\n');
      // First thead row is used as headers (with merged cell expansion and deduplication)
      expect(csvLines[0]).toBe('Person,Person_2');
      // Second thead row becomes first data row since only the first row is taken as headers
      // when there are multiple thead rows
      expect(csvLines.length).toBeGreaterThanOrEqual(2);
    });

    it('should convert HTML to TXT', async () => {
      const file = new File(['<h1>Hello</h1>'], 'test.html', { type: 'text/html' });
      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/plain');
      expect(result.fileName).toBe('test.txt');
    });

    it('should convert HTML to MD', async () => {
      const file = new File(['<h1>Hello</h1>'], 'test.html', { type: 'text/html' });
      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/markdown');
      expect(result.fileName).toBe('test.md');
    });
  });

  describe('CSV Conversions', () => {
    it('should convert CSV to JSON', async () => {
      const csvContent = 'name,age\nJohn,30\nJane,25';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.JSON);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('application/json');
      expect(result.fileName).toBe('test.json');
    });

    it('should convert CSV to XLSX', async () => {
      const csvContent = 'name,age\nJohn,30';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.XLSX);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.fileName).toBe('test.xlsx');
    });
  });

  describe('JSON Conversions', () => {
    it('should convert JSON to CSV', async () => {
      const jsonContent = JSON.stringify([{ name: 'John', age: 30 }]);
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });
      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/csv');
      expect(result.fileName).toBe('test.csv');
    });

    it('should convert JSON to XLSX', async () => {
      const jsonContent = JSON.stringify([{ name: 'John', age: 30 }]);
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });
      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.XLSX);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.fileName).toBe('test.xlsx');
    });

    it('should block JSON primitive arrays for CSV, XLSX and HTML tabular exports', async () => {
      const file = new File([JSON.stringify(['Ada', 'Linus'])], 'primitive-array.json', {
        type: 'application/json',
      });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.JSON_ARRAY_OF_OBJECTS_REQUIRED',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.XLSX)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.JSON_ARRAY_OF_OBJECTS_REQUIRED',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.JSON_ARRAY_OF_OBJECTS_REQUIRED',
        })
      );
    });

    it('should block JSON nested object arrays for CSV, XLSX and HTML tabular exports', async () => {
      const file = new File(
        [
          JSON.stringify([
            { id: 1, contacts: [{ type: 'email', value: 'ada@example.com' }] },
            { id: 2, contacts: [{ type: 'email', value: 'linus@example.com' }] },
          ]),
        ],
        'nested-object-array.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_TABULAR_DATA_REQUIRED',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.XLSX)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_TABULAR_DATA_REQUIRED',
        })
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: true,
          severity: 'danger',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_TABULAR_DATA_REQUIRED',
        })
      );
    });

    it('should warn and export flattened headers for nested JSON objects', async () => {
      const file = new File(
        [
          JSON.stringify([
            { id: 1, profile: { firstName: 'Ada', city: 'London' } },
            { id: 2, profile: { firstName: 'Linus', city: 'Helsinki' } },
          ]),
        ],
        'flattenable.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );

      const csvResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const htmlResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.HTML);
      const htmlText = await htmlResult.blob?.text();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain('id,profile.firstName,profile.city');
      expect(csvText).toContain('1,Ada,London');
      expect(csvText).toContain('2,Linus,Helsinki');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('id');
      expect(sheet['B1'].v).toBe('profile.firstName');
      expect(sheet['C1'].v).toBe('profile.city');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe('Ada');
      expect(sheet['C2'].v).toBe('London');

      expect(htmlResult.success).toBeTrue();
      expect(htmlText).toContain('<table');
      expect(htmlText).toContain('profile.firstName');
      expect(htmlText).toContain('profile.city');
      expect(htmlText).toContain('Helsinki');
    });

    it('should expose nested collection paths for structured exports', async () => {
      const file = new File(
        [JSON.stringify({ payload: { items: [{ id: 1 }], archived: [{ id: 2 }] } })],
        'nested.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.getStructuredDataExportProfile(file, ConversionFormat.JSON)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          collectionPaths: ['payload.items', 'payload.archived'],
        })
      );
    });

    it('should convert JSON to CSV using selected collection path and JSON array strategy', async () => {
      const jsonContent = JSON.stringify({
        payload: {
          items: [{ name: 'Ada', tags: ['math', 'logic'] }],
          archived: [{ name: 'Ignored' }],
        },
      });
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV, {
        structuredData: {
          collectionPath: 'payload.items',
          primitiveArrayStrategy: 'json',
        },
      });
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(csvText).toContain('name,tags');
      expect(csvText).toContain('Ada,"[""math"",""logic""]"');
      expect(csvText).not.toContain('Ignored');
    });

    it('should convert JSON to CSV with snake_case column names', async () => {
      const jsonContent = JSON.stringify([{ profile: { firstName: 'Ada' } }]);
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV, {
        structuredData: {
          columnNaming: 'snake_case',
        },
      });
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(csvText).toContain('profile_first_name');
      expect(csvText).toContain('Ada');
    });

    it('should warn and export single-record JSON as one row', async () => {
      const file = new File(
        [JSON.stringify({ id: 1, profile: { firstName: 'Ada', city: 'London' } })],
        'single-record.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );

      const csvResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const htmlResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.HTML);
      const htmlText = await htmlResult.blob?.text();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toBe('id,profile.firstName,profile.city\r\n1,Ada,London');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('id');
      expect(sheet['B1'].v).toBe('profile.firstName');
      expect(sheet['C1'].v).toBe('profile.city');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe('Ada');
      expect(sheet['C2'].v).toBe('London');

      expect(htmlResult.success).toBeTrue();
      expect(htmlText).toContain('<table');
      expect(htmlText).toContain('profile.firstName');
      expect(htmlText).toContain('Ada');
      expect(htmlText).toContain('London');
    });

    it('should preserve flattened column order consistently across CSV, HTML and XLSX exports', async () => {
      const file = new File(
        [
          JSON.stringify([
            {
              id: 1,
              profile: { firstName: 'Ada', lastName: 'Lovelace' },
              meta: { active: true, score: 99 },
            },
            {
              id: 2,
              profile: { firstName: 'Linus', lastName: 'Torvalds' },
              meta: { active: false, score: 100 },
            },
          ]),
        ],
        'ordered.json',
        { type: 'application/json' }
      );

      const csvResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const [headerLine] = csvText?.split(/\r?\n/) ?? [];

      const htmlResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.HTML);
      const htmlText = await htmlResult.blob?.text();

      const xlsxResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(headerLine).toBe('id,profile.firstName,profile.lastName,meta.active,meta.score');

      expect(htmlResult.success).toBeTrue();
      expect(htmlText).toContain('<td data-t="s" data-v="id" id="sjs-A1">id</td>');
      const idHeaderIndex = htmlText?.indexOf('>id</td>') ?? -1;
      const firstNameHeaderIndex = htmlText?.indexOf('>profile.firstName</td>') ?? -1;
      const lastNameHeaderIndex = htmlText?.indexOf('>profile.lastName</td>') ?? -1;
      const activeHeaderIndex = htmlText?.indexOf('>meta.active</td>') ?? -1;
      const scoreHeaderIndex = htmlText?.indexOf('>meta.score</td>') ?? -1;

      expect(idHeaderIndex).toBeLessThan(firstNameHeaderIndex);
      expect(firstNameHeaderIndex).toBeLessThan(lastNameHeaderIndex);
      expect(lastNameHeaderIndex).toBeLessThan(activeHeaderIndex);
      expect(activeHeaderIndex).toBeLessThan(scoreHeaderIndex);

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('id');
      expect(sheet['B1'].v).toBe('profile.firstName');
      expect(sheet['C1'].v).toBe('profile.lastName');
      expect(sheet['D1'].v).toBe('meta.active');
      expect(sheet['E1'].v).toBe('meta.score');
    });

    it('should flatten null, booleans, numbers and primitive arrays with join strategy', async () => {
      const file = new File(
        [
          JSON.stringify([
            {
              id: 1,
              profile: {
                age: 36,
                subscribed: true,
                nickname: null,
              },
              tags: ['math', 'logic'],
              scores: [10, 20],
            },
          ]),
        ],
        'mixed-primitives.json',
        { type: 'application/json' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.JSON, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );

      const csvResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const htmlResult = await service.convert(file, ConversionFormat.JSON, ConversionFormat.HTML);
      const htmlText = await htmlResult.blob?.text();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain('id,profile.age,profile.subscribed,profile.nickname,tags,scores');
      expect(csvText).toContain('1,36,true,,"math, logic","10, 20"');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('id');
      expect(sheet['B1'].v).toBe('profile.age');
      expect(sheet['C1'].v).toBe('profile.subscribed');
      expect(sheet['D1'].v).toBe('profile.nickname');
      expect(sheet['E1'].v).toBe('tags');
      expect(sheet['F1'].v).toBe('scores');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe(36);
      expect(sheet['C2'].v).toBe(true);
      expect(sheet['D2']).toBeUndefined();
      expect(sheet['E2'].v).toBe('math, logic');
      expect(sheet['F2'].v).toBe('10, 20');

      expect(htmlResult.success).toBeTrue();
      expect(htmlText).toContain('profile.nickname');
      expect(htmlText).toContain('math, logic');
      expect(htmlText).toContain('10, 20');
    });

    it('should flatten primitive arrays with json strategy while preserving booleans and nulls', async () => {
      const file = new File(
        [
          JSON.stringify([
            {
              id: 1,
              enabled: false,
              note: null,
              tags: ['math', 'logic'],
            },
          ]),
        ],
        'primitive-array-json-strategy.json',
        { type: 'application/json' }
      );

      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV, {
        structuredData: {
          primitiveArrayStrategy: 'json',
        },
      });
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(csvText).toContain('id,enabled,note,tags');
      expect(csvText).toContain('1,false,,"[""math"",""logic""]"');
    });
  });

  describe('XML Conversions', () => {
    it('should convert XML to HTML with flattened headers and values', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <items>
              <item>
                <id>1</id>
                <profile>
                  <firstName>Ada</firstName>
                  <city>London</city>
                </profile>
              </item>
              <item>
                <id>2</id>
                <profile>
                  <firstName>Linus</firstName>
                  <city>Helsinki</city>
                </profile>
              </item>
            </items>
          </root>`,
        ],
        'structured.xml',
        { type: 'application/xml' }
      );

      const result = await service.convert(file, ConversionFormat.XML, ConversionFormat.HTML);
      const htmlText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('structured.html');
      expect(result.mimeType).toBe('text/html');
      expect(htmlText).toContain('<table');
      expect(htmlText).toContain('id');
      expect(htmlText).toContain('profile.firstName');
      expect(htmlText).toContain('profile.city');
      expect(htmlText).toContain('Ada');
      expect(htmlText).toContain('Helsinki');
    });

    it('should convert XML to XLSX with flattened headers and typed values', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <items>
              <item>
                <id>1</id>
                <profile>
                  <firstName>Ada</firstName>
                  <city>London</city>
                </profile>
              </item>
              <item>
                <id>2</id>
                <profile>
                  <firstName>Linus</firstName>
                  <city>Helsinki</city>
                </profile>
              </item>
            </items>
          </root>`,
        ],
        'structured.xml',
        { type: 'application/xml' }
      );

      const result = await service.convert(file, ConversionFormat.XML, ConversionFormat.XLSX);
      const xlsxBuffer = await result.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('structured.xlsx');
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(sheet['A1'].v).toBe('id');
      expect(sheet['B1'].v).toBe('profile.firstName');
      expect(sheet['C1'].v).toBe('profile.city');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe('Ada');
      expect(sheet['C2'].v).toBe('London');
      expect(sheet['A3'].v).toBe(2);
      expect(sheet['B3'].v).toBe('Linus');
      expect(sheet['C3'].v).toBe('Helsinki');
    });

    it('should preserve snake_case flattened naming order for XML tabular exports', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <items>
              <item>
                <recordId>1</recordId>
                <profile>
                  <firstName>Ada</firstName>
                  <lastName>Lovelace</lastName>
                </profile>
                <meta>
                  <isActive>true</isActive>
                </meta>
              </item>
            </items>
          </root>`,
        ],
        'snake-case.xml',
        { type: 'application/xml' }
      );

      const csvResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.CSV, {
        structuredData: {
          columnNaming: 'snake_case',
        },
      });
      const csvText = await csvResult.blob?.text();
      const [headerLine] = csvText?.split(/\r?\n/) ?? [];

      const xlsxResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.XLSX, {
        structuredData: {
          columnNaming: 'snake_case',
        },
      });
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(headerLine).toBe(
        'xml_version,root_items_item_record_id,root_items_item_profile_first_name,root_items_item_profile_last_name,root_items_item_meta_is_active'
      );
      expect(csvText).toContain('1,1,Ada,Lovelace,true');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('xml_version');
      expect(sheet['B1'].v).toBe('root_items_item_record_id');
      expect(sheet['C1'].v).toBe('root_items_item_profile_first_name');
      expect(sheet['D1'].v).toBe('root_items_item_profile_last_name');
      expect(sheet['E1'].v).toBe('root_items_item_meta_is_active');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe(1);
      expect(sheet['C2'].v).toBe('Ada');
      expect(sheet['D2'].v).toBe('Lovelace');
      expect(sheet['E2'].v).toBe(true);
    });

    it('should flatten null, booleans, numbers and primitive arrays from XML with join strategy', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <items>
              <item>
                <id>1</id>
                <profile>
                  <age>36</age>
                  <subscribed>true</subscribed>
                  <nickname></nickname>
                </profile>
                <tags>math</tags>
                <tags>logic</tags>
                <scores>10</scores>
                <scores>20</scores>
              </item>
            </items>
          </root>`,
        ],
        'mixed-primitives.xml',
        { type: 'application/xml' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.HTML)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );

      const csvResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain(
        '?xml.@_version,root.items.item.id,root.items.item.profile.age,root.items.item.profile.subscribed,root.items.item.profile.nickname,root.items.item.tags,root.items.item.scores'
      );
      expect(csvText).toContain('1,1,36,true,,"math, logic","10, 20"');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('?xml.@_version');
      expect(sheet['B1'].v).toBe('root.items.item.id');
      expect(sheet['C1'].v).toBe('root.items.item.profile.age');
      expect(sheet['D1'].v).toBe('root.items.item.profile.subscribed');
      expect(sheet['E1'].v).toBe('root.items.item.profile.nickname');
      expect(sheet['F1'].v).toBe('root.items.item.tags');
      expect(sheet['G1'].v).toBe('root.items.item.scores');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe(1);
      expect(sheet['C2'].v).toBe(36);
      expect(sheet['D2'].v).toBe(true);
      expect(sheet['E2'].v).toBe('');
      expect(sheet['F2'].v).toBe('math, logic');
      expect(sheet['G2'].v).toBe('10, 20');
    });

    it('should warn and export single-record XML as one normalized row', async () => {
      const file = new File(
        [
          `<?xml version="1.0"?>
          <root>
            <item>
              <id>1</id>
              <profile>
                <firstName>Ada</firstName>
                <city>London</city>
              </profile>
            </item>
          </root>`,
        ],
        'single-record.xml',
        { type: 'application/xml' }
      );

      await expectAsync(
        service.validateConversion(file, ConversionFormat.XML, ConversionFormat.CSV)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.STRUCTURED_DATA_NORMALIZED',
        })
      );

      const csvResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.CSV);
      const csvText = await csvResult.blob?.text();
      const xlsxResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.XLSX);
      const xlsxBuffer = await xlsxResult.blob?.arrayBuffer();
      const htmlResult = await service.convert(file, ConversionFormat.XML, ConversionFormat.HTML);
      const htmlText = await htmlResult.blob?.text();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(xlsxBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      expect(csvResult.success).toBeTrue();
      expect(csvText).toContain(
        '?xml.@_version,root.item.id,root.item.profile.firstName,root.item.profile.city'
      );
      expect(csvText).toContain('1,1,Ada,London');

      expect(xlsxResult.success).toBeTrue();
      expect(sheet['A1'].v).toBe('?xml.@_version');
      expect(sheet['B1'].v).toBe('root.item.id');
      expect(sheet['C1'].v).toBe('root.item.profile.firstName');
      expect(sheet['D1'].v).toBe('root.item.profile.city');
      expect(sheet['A2'].v).toBe(1);
      expect(sheet['B2'].v).toBe(1);
      expect(sheet['C2'].v).toBe('Ada');
      expect(sheet['D2'].v).toBe('London');

      expect(htmlResult.success).toBeTrue();
      expect(htmlText).toContain('<table');
      expect(htmlText).toContain('root.item.profile.firstName');
      expect(htmlText).toContain('Ada');
      expect(htmlText).toContain('London');
    });
  });

  describe('Image Conversions', () => {
    it('should convert PNG to JPEG', async () => {
      const mockBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
      imageServiceSpy.convertImage.and.returnValue(Promise.resolve(mockBlob));

      const file = new File(['png'], 'test.png', { type: 'image/png' });
      const result = await service.convert(file, ConversionFormat.PNG, ConversionFormat.JPEG);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.fileName).toBe('test.jpeg');
      expect(imageServiceSpy.convertImage).toHaveBeenCalled();
    });

    it('should convert PNG to PDF', async () => {
      const mockPdfBytes = new Uint8Array([1, 2, 3]);
      pdfServiceSpy.createPdfFromImage.and.returnValue(Promise.resolve(mockPdfBytes));

      const file = new File(['png'], 'test.png', { type: 'image/png' });
      const result = await service.convert(file, ConversionFormat.PNG, ConversionFormat.PDF);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileName).toBe('test.pdf');
      expect(pdfServiceSpy.createPdfFromImage).toHaveBeenCalled();
    });
  });

  describe('PDF Conversions', () => {
    it('should convert PDF to TXT', async () => {
      pdfServiceSpy.extractTextFromPdf.and.returnValue(Promise.resolve('Extracted text'));

      const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
      const result = await service.convert(file, ConversionFormat.PDF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('text/plain');
      expect(result.fileName).toBe('test.txt');
      expect(pdfServiceSpy.extractTextFromPdf).toHaveBeenCalled();
    });

    it('should convert PDF to PNG', async () => {
      const mockBlob = new Blob(['png'], { type: 'image/png' });
      pdfServiceSpy.convertPdfPageToImage.and.returnValue(Promise.resolve(mockBlob));

      const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });
      const result = await service.convert(file, ConversionFormat.PDF, ConversionFormat.PNG);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.mimeType).toBe('image/png');
      expect(result.fileName).toBe('test.png');
      expect(pdfServiceSpy.convertPdfPageToImage).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported conversions', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.TXT);

      expect(result.success).toBeFalse();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not supported');
    });

    it('should handle empty files correctly', async () => {
      // Empty file should convert successfully
      const file = new File([], 'test.txt', { type: 'text/plain' });

      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.fileName).toBe('test.md');
    });

    it('should fail HTML tabular export for blank HTML content', async () => {
      const file = new File(['   <div>   </div>   '], 'blank.html', { type: 'text/html' });

      const result = await service.convert(file, ConversionFormat.HTML, ConversionFormat.CSV);

      expect(result.success).toBeFalse();
      expect(result.error).toContain('tabular structure');
    });

    it('should fail structured tabular export for blank JSON content', async () => {
      const file = new File(['   '], 'blank.json', { type: 'application/json' });

      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);

      expect(result.success).toBeFalse();
      expect(result.error).toContain('Unexpected end of JSON input');
    });

    it('should export an empty CSV for valid but empty JSON arrays', async () => {
      const file = new File(['[]'], 'empty-array.json', { type: 'application/json' });

      const result = await service.convert(file, ConversionFormat.JSON, ConversionFormat.CSV);
      const csvText = await result.blob?.text();

      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('empty-array.csv');
      expect(csvText).toBe('');
    });

    it('should fail structured tabular export for blank XML content', async () => {
      const file = new File(['   '], 'blank.xml', { type: 'application/xml' });

      const result = await service.convert(file, ConversionFormat.XML, ConversionFormat.HTML);

      expect(result.success).toBeFalse();
      expect(result.error).toContain('Failed to parse XML');
    });

    it('should handle PDF service errors', async () => {
      pdfServiceSpy.createPdfFromText.and.callFake(async () => {
        throw new Error('PDF creation failed');
      });

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.PDF);

      expect(result.success).toBeFalse();
      expect(result.error).toBe('PDF creation failed');
    });
  });

  describe('Conversion Options', () => {
    it('should use custom quality for image conversions', async () => {
      const mockBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
      imageServiceSpy.convertImage.and.returnValue(Promise.resolve(mockBlob));

      const file = new File(['png'], 'test.png', { type: 'image/png' });
      await service.convert(file, ConversionFormat.PNG, ConversionFormat.JPEG, { quality: 90 });

      expect(imageServiceSpy.convertImage).toHaveBeenCalledWith(
        jasmine.any(File),
        ConversionFormat.JPEG,
        90,
        false // preserveExif default
      );
    });

    it('should use default quality when not specified', async () => {
      const mockBlob = new Blob(['jpeg'], { type: 'image/jpeg' });
      imageServiceSpy.convertImage.and.returnValue(Promise.resolve(mockBlob));

      const file = new File(['png'], 'test.png', { type: 'image/png' });
      await service.convert(file, ConversionFormat.PNG, ConversionFormat.JPEG);

      expect(imageServiceSpy.convertImage).toHaveBeenCalledWith(
        jasmine.any(File),
        ConversionFormat.JPEG,
        null, // quality adaptive
        false // preserveExif default
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track conversion duration', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include file size in result', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.size).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('Timeout and Cancellation', () => {
    it('should return timeout error when conversion exceeds timeout', async () => {
      // Override timeout to a very short value for testing
      const origMethod = (service as any).getTimeoutForFormat.bind(service);
      spyOn(service, 'getTimeoutForFormat').and.returnValue(1);

      // Use a slow PDF extraction to trigger timeout
      pdfServiceSpy.extractTextFromPdf.and.callFake(
        () => new Promise((resolve) => setTimeout(() => resolve('text'), 500))
      );

      const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
      const result = await service.convert(file, ConversionFormat.PDF, ConversionFormat.TXT);

      expect(result.success).toBeFalse();
      expect(result.error).toContain('timed out');
    });

    it('should return cancelled error when abort signal fires before completion', async () => {
      pdfServiceSpy.extractTextFromPdf.and.callFake(
        () => new Promise((resolve) => setTimeout(() => resolve('text'), 500))
      );

      const controller = new AbortController();
      const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });

      // Abort after 10ms
      setTimeout(() => controller.abort(), 10);

      const result = await service.convert(file, ConversionFormat.PDF, ConversionFormat.TXT, {
        signal: controller.signal,
      });

      expect(result.success).toBeFalse();
      expect(result.error).toContain('cancelled');
    });

    it('should return cancelled error when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const file = new File(['Hello'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD, {
        signal: controller.signal,
      });

      expect(result.success).toBeFalse();
      expect(result.error).toContain('cancelled');
    });

    it('should succeed when conversion completes before timeout', async () => {
      const file = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
    });

    it('should return per-category timeout for PDF format', () => {
      const timeout = service.getTimeoutForFormat(ConversionFormat.PDF);
      expect(timeout).toBe(180_000);
    });

    it('should return per-category timeout for spreadsheet formats', () => {
      const timeout = service.getTimeoutForFormat(ConversionFormat.JSON);
      expect(timeout).toBe(120_000);
    });

    it('should return per-category timeout for data formats', () => {
      const timeout = service.getTimeoutForFormat(ConversionFormat.XML);
      expect(timeout).toBe(60_000);
    });
  });

  describe('EPUB conversions', () => {
    it('should support EPUB -> PDF', () => {
      const support = service.getConversionSupport(ConversionFormat.EPUB, ConversionFormat.PDF);
      expect(support).not.toBeNull();
      expect(support!.reliability).toBe('best-effort');
    });

    it('should support EPUB -> RTF', () => {
      const support = service.getConversionSupport(ConversionFormat.EPUB, ConversionFormat.RTF);
      expect(support).not.toBeNull();
      expect(support!.reliability).toBe('best-effort');
    });

    it('should convert EPUB -> PDF via HTML pipeline', async () => {
      const epubService = TestBed.inject(EpubService);
      spyOn(epubService, 'extractHtmlFromEpub').and.resolveTo(
        '<h1>Chapter 1</h1><p>Hello EPUB world</p>'
      );
      pdfServiceSpy.createPdfFromHtml.and.resolveTo(new Uint8Array([37, 80, 68, 70]));

      const file = new File(['fake-epub'], 'test.epub', { type: 'application/epub+zip' });
      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.PDF);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.blob!.type).toBe('application/pdf');
      expect(epubService.extractHtmlFromEpub).toHaveBeenCalledWith(file);
      expect(pdfServiceSpy.createPdfFromHtml).toHaveBeenCalledWith(
        '<h1>Chapter 1</h1><p>Hello EPUB world</p>'
      );
    });

    it('should convert EPUB -> RTF via HTML pipeline', async () => {
      const epubService = TestBed.inject(EpubService);
      const rtfService = TestBed.inject(RtfService);
      spyOn(epubService, 'extractHtmlFromEpub').and.resolveTo('<p>Hello EPUB world</p>');
      spyOn(rtfService, 'htmlToRtf').and.resolveTo('{\\rtf1\\ansi Hello EPUB world}');

      const file = new File(['fake-epub'], 'test.epub', { type: 'application/epub+zip' });
      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.RTF);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.blob!.type).toBe('application/rtf');
      expect(epubService.extractHtmlFromEpub).toHaveBeenCalledWith(file);
      expect(rtfService.htmlToRtf).toHaveBeenCalled();
    });

    it('should warn on EPUB -> PDF as fragile multi-step conversion', async () => {
      const file = new File(['fake-epub'], 'test.epub', { type: 'application/epub+zip' });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.EPUB, ConversionFormat.PDF)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.MULTI_STEP_REVIEW',
        })
      );
    });

    it('should warn on EPUB -> RTF as fragile multi-step conversion', async () => {
      const file = new File(['fake-epub'], 'test.epub', { type: 'application/epub+zip' });

      await expectAsync(
        service.validateConversion(file, ConversionFormat.EPUB, ConversionFormat.RTF)
      ).toBeResolvedTo(
        jasmine.objectContaining({
          blocking: false,
          severity: 'warning',
          messageKey: 'CONVERSION_VALIDATION.MULTI_STEP_REVIEW',
        })
      );
    });

    // --- Test di estrazione EPUB reale con zip in-memory ---

    async function buildEpubZip(options: {
      rootDir?: string;
      chapters: { id: string; filename: string; title: string; body: string }[];
      spineOrder?: string[];
      css?: string;
      includeNav?: boolean;
      skipContainer?: boolean;
      metadata?: { title?: string; author?: string; publisher?: string; language?: string };
      outputFileName?: string;
    }): Promise<File> {
      const zip = new JSZip();
      const dir = options.rootDir ?? 'OEBPS';
      const meta = options.metadata ?? {};
      const bookTitle = meta.title ?? 'Test Book';
      const bookLanguage = meta.language ?? 'en';

      // container.xml
      if (!options.skipContainer) {
        zip.folder('META-INF')!.file(
          'container.xml',
          `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${dir}/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
        );
      }

      const folder = dir ? zip.folder(dir)! : zip;

      // manifest items
      const manifestItems = options.chapters
        .map(
          (ch) => `<item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`
        )
        .join('\n    ');

      let navManifest = '';
      if (options.includeNav !== false) {
        navManifest = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`;
      }

      let cssManifest = '';
      if (options.css) {
        cssManifest = `<item id="css" href="styles.css" media-type="text/css"/>`;
        folder.file('styles.css', options.css);
      }

      // spine
      const spineIds = options.spineOrder ?? options.chapters.map((ch) => ch.id);
      const spineItems = spineIds.map((id) => `<itemref idref="${id}"/>`).join('\n    ');

      // metadata opzionali
      const authorTag = meta.author ? `\n    <dc:creator>${meta.author}</dc:creator>` : '';
      const publisherTag = meta.publisher
        ? `\n    <dc:publisher>${meta.publisher}</dc:publisher>`
        : '';

      // content.opf
      folder.file(
        'content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:test-uuid</dc:identifier>
    <dc:title>${bookTitle}</dc:title>
    <dc:language>${bookLanguage}</dc:language>${authorTag}${publisherTag}
  </metadata>
  <manifest>
    ${manifestItems}
    ${navManifest}
    ${cssManifest}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
      );

      // chapter files
      for (const ch of options.chapters) {
        folder.file(
          ch.filename,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${ch.title}</title></head>
<body>${ch.body}</body>
</html>`
        );
      }

      // nav.xhtml
      if (options.includeNav !== false) {
        folder.file(
          'nav.xhtml',
          `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Nav</title></head>
<body><nav><ol>${options.chapters.map((ch) => `<li><a href="${ch.filename}">${ch.title}</a></li>`).join('')}</ol></nav></body>
</html>`
        );
      }

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      return new File([blob], options.outputFileName ?? 'test.epub', {
        type: 'application/epub+zip',
      });
    }

    it('should extract HTML from EPUB with standard OEBPS structure', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'Chapter 1', body: '<p>First chapter</p>' },
          { id: 'ch2', filename: 'ch2.html', title: 'Chapter 2', body: '<p>Second chapter</p>' },
        ],
      });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('First chapter');
      expect(html).toContain('Second chapter');
    });

    it('should extract HTML from EPUB with non-standard rootfile path', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        rootDir: 'OPS',
        chapters: [
          { id: 'ch1', filename: 'chapter1.xhtml', title: 'Intro', body: '<p>OPS-based EPUB</p>' },
        ],
      });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('OPS-based EPUB');
    });

    it('should follow spine order when extracting chapters', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'First', body: '<p>AAA</p>' },
          { id: 'ch2', filename: 'ch2.html', title: 'Second', body: '<p>BBB</p>' },
          { id: 'ch3', filename: 'ch3.html', title: 'Third', body: '<p>CCC</p>' },
        ],
        spineOrder: ['ch3', 'ch1', 'ch2'],
      });

      const html = await epubService.extractHtmlFromEpub(file);
      const posC = html.indexOf('CCC');
      const posA = html.indexOf('AAA');
      const posB = html.indexOf('BBB');
      expect(posC).toBeLessThan(posA);
      expect(posA).toBeLessThan(posB);
    });

    it('should exclude nav document from extracted HTML', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'Real Content', body: '<p>Chapter text</p>' },
        ],
        includeNav: true,
      });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('Chapter text');
      // nav.xhtml contiene un <ol> con link — non deve comparire nel contenuto estratto
      expect(html).not.toContain('<nav');
    });

    it('should preserve CSS from EPUB stylesheets as inline style tag', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          {
            id: 'ch1',
            filename: 'ch1.html',
            title: 'Styled',
            body: '<p class="intro">Styled text</p>',
          },
        ],
        css: 'p.intro { color: red; font-size: 16px; }',
      });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('<style>');
      expect(html).toContain('color: red');
      expect(html).toContain('Styled text');
    });

    it('should extract text from EPUB without CSS contamination', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Clean text here</p>' },
        ],
        css: 'body { margin: 0; } .hidden { display: none; }',
      });

      const text = await epubService.extractTextFromEpub(file);
      expect(text).toContain('Clean text here');
      expect(text).not.toContain('margin');
      expect(text).not.toContain('display');
    });

    it('should throw on EPUB with no readable content', async () => {
      const zip = new JSZip();
      zip.folder('META-INF')!.file(
        'container.xml',
        `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
      );
      zip.folder('OEBPS')!.file(
        'content.opf',
        `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">x</dc:identifier><dc:title>Empty</dc:title><dc:language>en</dc:language></metadata>
<manifest></manifest><spine></spine></package>`
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'empty.epub', { type: 'application/epub+zip' });
      const epubService = TestBed.inject(EpubService);

      await expectAsync(epubService.extractHtmlFromEpub(file)).toBeRejectedWithError(
        /no readable chapter content/
      );
    });

    it('should throw on invalid EPUB without content.opf', async () => {
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'bad.epub', { type: 'application/epub+zip' });
      const epubService = TestBed.inject(EpubService);

      await expectAsync(epubService.extractHtmlFromEpub(file)).toBeRejectedWithError(
        /cannot locate content\.opf/
      );
    });

    it('should fallback to OEBPS/content.opf when container.xml is missing', async () => {
      const epubService = TestBed.inject(EpubService);
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'Fallback', body: '<p>Fallback path</p>' },
        ],
        skipContainer: true,
      });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('Fallback path');
    });

    it('should convert EPUB -> TXT with real multi-chapter extraction', async () => {
      const file = await buildEpubZip({
        chapters: [
          {
            id: 'ch1',
            filename: 'ch1.html',
            title: 'Ch1',
            body: '<h1>Title</h1><p>First paragraph.</p>',
          },
          {
            id: 'ch2',
            filename: 'ch2.html',
            title: 'Ch2',
            body: '<p>Second paragraph with <strong>bold</strong>.</p>',
          },
        ],
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      const text = await result.blob!.text();
      expect(text).toContain('First paragraph');
      expect(text).toContain('Second paragraph with bold');
    });

    it('should convert EPUB -> HTML preserving CSS from EPUB stylesheets', async () => {
      const file = await buildEpubZip({
        chapters: [
          {
            id: 'ch1',
            filename: 'ch1.html',
            title: 'Styled',
            body: '<p class="highlight">Important</p>',
          },
        ],
        css: '.highlight { background: yellow; }',
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.HTML);
      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Important');
      expect(html).toContain('background: yellow');
    });

    it('should sanitize EPUB HTML exports by default', async () => {
      const file = await buildEpubZip({
        chapters: [
          {
            id: 'ch1',
            filename: 'ch1.html',
            title: 'Unsafe',
            body: `<p>Safe text</p>
              <img src="cover.png" onerror="alert('xss')" />
              <a href="javascript:alert('xss')">Click</a>
              <script>alert('xss')</script>`,
          },
        ],
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.HTML);
      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('Safe text');
      expect(html).not.toContain('onerror=');
      expect(html).not.toContain('javascript:alert');
      expect(html).not.toContain('<script');
    });

    it('should convert EPUB -> MD with real extraction', async () => {
      const file = await buildEpubZip({
        chapters: [
          {
            id: 'ch1',
            filename: 'ch1.html',
            title: 'Ch1',
            body: '<h1>Heading</h1><p>Paragraph text.</p><ul><li>Item one</li><li>Item two</li></ul>',
          },
        ],
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.MD);
      expect(result.success).toBeTrue();
      const md = await result.blob!.text();
      // Turndown usa setext-style per h1 (Heading\n=======)
      expect(md).toContain('Heading');
      expect(md).toContain('Paragraph text');
      expect(md).toMatch(/[*-]\s+Item one/);
    });

    // --- P5.2: Test metadata EPUB per output naming ---

    it('should use EPUB title in output filename for EPUB → TXT (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: 'Il Grande Gatsby', author: 'F. Scott Fitzgerald' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('Il_Grande_Gatsby_-_F._Scott_Fitzgerald.txt');
    });

    it('should use EPUB title in output filename for EPUB → HTML (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: 'La Divina Commedia', author: 'Dante Alighieri' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.HTML);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('La_Divina_Commedia_-_Dante_Alighieri.html');
    });

    it('should use EPUB title in HTML <title> tag for EPUB → HTML (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Canto I</p>' }],
        metadata: { title: 'La Divina Commedia' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.HTML);
      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<title>La Divina Commedia</title>');
      expect(html).not.toContain('<title>Document</title>');
    });

    it('should use title-only filename when no author is available (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: 'Manuale Utente' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('Manuale_Utente.txt');
    });

    it('should sanitize special characters from EPUB title in filename (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: "L'arte: un viaggio? Sì*" },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      // Caratteri illegali (:, ?, *) rimossi, spazi → underscore
      expect(result.fileName).toBe("L'arte_un_viaggio_Sì.txt");
    });

    it('should include EPUB metadata in ConversionResult (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: 'Test Title', author: 'Test Author' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      expect(result.metadata).toBeDefined();
      expect(result.metadata!['epubTitle']).toBe('Test Title');
      expect(result.metadata!['epubAuthor']).toBe('Test Author');
    });

    it('should use EPUB title for EPUB → MD filename (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [
          { id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<h1>Heading</h1><p>Text</p>' },
        ],
        metadata: { title: 'Promessi Sposi', author: 'Alessandro Manzoni' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.MD);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('Promessi_Sposi_-_Alessandro_Manzoni.md');
    });

    it('should use EPUB title for EPUB → PDF filename (P5.2)', async () => {
      pdfServiceSpy.createPdfFromHtml.and.resolveTo(new Uint8Array([1, 2, 3]));

      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
        metadata: { title: 'Il Nome della Rosa', author: 'Umberto Eco' },
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.PDF);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('Il_Nome_della_Rosa_-_Umberto_Eco.pdf');
    });

    it('should use default EPUB title for filename when no custom metadata (P5.2)', async () => {
      const file = await buildEpubZip({
        chapters: [{ id: 'ch1', filename: 'ch1.html', title: 'Ch1', body: '<p>Content</p>' }],
      });

      const result = await service.convert(file, ConversionFormat.EPUB, ConversionFormat.TXT);
      expect(result.success).toBeTrue();
      expect(result.fileName).toBe('Test_Book.txt');
    });
  });

  describe('RTF conversions', () => {
    it('should convert RTF -> TXT using direct text extraction', async () => {
      const rtf =
        '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\b Bold text} and plain text\\par\nSecond paragraph\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      expect(result.blob).toBeDefined();
      expect(result.blob!.type).toBe('text/plain');
      const text = await result.blob!.text();
      expect(text).toContain('Bold text');
      expect(text).toContain('plain text');
    });

    it('should convert RTF -> HTML preserving bold formatting', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\b Bold text} and plain text\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<strong>');
      expect(html).toContain('Bold text');
      expect(html).toContain('plain text');
    });

    it('should convert RTF -> HTML preserving italic formatting', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\i Italic text} normal\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<em>');
      expect(html).toContain('Italic text');
    });

    it('should convert RTF -> HTML preserving underline formatting', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\ul Underlined text} normal\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<u>');
      expect(html).toContain('Underlined text');
    });

    it('should convert RTF -> HTML with multiple paragraphs', async () => {
      const rtf =
        '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\nFirst paragraph\\par\nSecond paragraph\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('First paragraph');
      expect(html).toContain('Second paragraph');
      // Should have separate paragraphs
      const pCount = (html.match(/<p>/g) || []).length;
      expect(pCount).toBeGreaterThanOrEqual(2);
    });

    it('should convert RTF -> MD preserving bold via HTML intermediate', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\b Important} and normal text\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.blob!.type).toBe('text/markdown');
      const md = await result.blob!.text();
      // Turndown should convert <strong> to **bold**
      expect(md).toContain('**Important**');
      expect(md).toContain('normal text');
    });

    it('should convert RTF -> MD preserving italic via HTML intermediate', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\i Emphasis} here\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      const md = await result.blob!.text();
      // Turndown converts <em> to _italic_ (underscore style)
      expect(md).toContain('_Emphasis_');
    });

    it('should skip RTF destination groups (fonttbl, colortbl) without emitting them as text', async () => {
      const rtf =
        '{\\rtf1\\ansi{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\froman Times;}}{\\colortbl;\\red0\\green0\\blue0;}\nVisible text\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('Visible text');
      expect(html).not.toContain('fonttbl');
      expect(html).not.toContain('colortbl');
      // "fswiss" and "froman" are RTF font family keywords that must not leak into HTML body
      expect(html).not.toContain('fswiss');
      expect(html).not.toContain('froman');
    });

    it('should handle RTF hex escapes in text extraction', async () => {
      // \'e8 = è, \'e0 = à
      const rtf = "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\ncaf\\'e8 e citt\\'e0\n}";
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      const text = await result.blob!.text();
      expect(text).toContain('cafè');
      expect(text).toContain('città');
    });

    it('should handle RTF with combined bold+italic formatting', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\b\\i Bold and italic}\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      expect(html).toContain('Bold and italic');
    });

    it('should handle RTF Unicode escapes (\\uN) in HTML output', async () => {
      // \u8217 = right single quotation mark ('), ? is ANSI fallback
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\ndon\\u8217?t stop\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('don\u2019t stop');
      expect(html).not.toContain('don\u2019?');
    });

    it('should handle RTF Unicode escapes in text extraction', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\ndon\\u8217?t stop\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      const text = await result.blob!.text();
      expect(text).toContain('don\u2019t stop');
      expect(text).not.toContain('don\u2019?');
    });

    it('should handle RTF negative Unicode values as unsigned', async () => {
      // \u-4 should produce codepoint 65532 (U+FFFC, object replacement character)
      const rtf = '{\\rtf1\\ansi before\\u-4?after}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      const text = await result.blob!.text();
      expect(text).toContain('before');
      expect(text).toContain('after');
      expect(text).not.toContain('?');
    });

    it('should respect \\uc0 to skip zero fallback bytes after Unicode', async () => {
      // \uc0 means no ANSI fallback to skip
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\uc0 hello\\u8212 world}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.TXT);

      expect(result.success).toBeTrue();
      const text = await result.blob!.text();
      // \u8212 = em dash, with \uc0 the space after \u8212 is consumed as control delimiter, not fallback
      expect(text).toContain('hello\u2014');
      expect(text).toContain('world');
    });

    it('should reset formatting with \\plain control word', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\b Bold text}\\plain  Normal text\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<strong>Bold text</strong>');
      expect(html).toContain('Normal text');
      // "Normal text" should not be wrapped in <strong>
      expect(html).not.toMatch(/<strong>[^<]*Normal text/);
    });

    it('should convert RTF strikethrough to <s> in HTML', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n{\\strike Deleted text}\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<s>Deleted text</s>');
    });

    it('should turn off strikethrough with \\strike0', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\n\\strike Struck\\strike0  Normal\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<s>Struck</s>');
      expect(html).toContain('Normal');
      expect(html).not.toMatch(/<s>[^<]*Normal/);
    });

    it('should convert RTF superscript to <sup> in HTML', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\nE=mc{\\super 2}\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<sup>2</sup>');
      expect(html).toContain('E=mc');
    });

    it('should convert RTF subscript to <sub> in HTML', async () => {
      const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\nH{\\sub 2}O\n}';
      const file = new File([rtf], 'test.rtf', { type: 'application/rtf' });
      const result = await service.convert(file, ConversionFormat.RTF, ConversionFormat.HTML);

      expect(result.success).toBeTrue();
      const html = await result.blob!.text();
      expect(html).toContain('<sub>2</sub>');
      expect(html).toContain('H');
      expect(html).toContain('O');
    });
  });

  describe('EPUB robustness', () => {
    it('should extract HTML from EPUB with percent-encoded filenames', async () => {
      const epubService = TestBed.inject(EpubService);
      const zip = new JSZip();
      const dir = 'OEBPS';

      zip.folder('META-INF')!.file(
        'container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${dir}/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      const folder = zip.folder(dir)!;

      // Manifest references percent-encoded filename, but actual file uses decoded name
      folder.file(
        'content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:test</dc:identifier>
    <dc:title>Test</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="Chapter%201.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`
      );

      // File stored with decoded name
      folder.file(
        'Chapter 1.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ch1</title></head>
<body><p>Percent encoded chapter</p></body>
</html>`
      );

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('Percent encoded chapter');
    });

    it('should gracefully skip missing spine items without crashing', async () => {
      const epubService = TestBed.inject(EpubService);
      const zip = new JSZip();
      const dir = 'OEBPS';

      zip.folder('META-INF')!.file(
        'container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${dir}/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      const folder = zip.folder(dir)!;

      // Spine references ch1 and ch2, but only ch1 file exists
      folder.file(
        'content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:test</dc:identifier>
    <dc:title>Test</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
      );

      // Only ch1 exists
      folder.file(
        'ch1.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ch1</title></head>
<body><p>Only this chapter exists</p></body>
</html>`
      );

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });

      const html = await epubService.extractHtmlFromEpub(file);
      expect(html).toContain('Only this chapter exists');
    });

    it('should extract metadata from EPUB content.opf', async () => {
      const epubService = TestBed.inject(EpubService);
      const zip = new JSZip();
      const dir = 'OEBPS';

      zip.folder('META-INF')!.file(
        'container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${dir}/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );

      const folder = zip.folder(dir)!;

      folder.file(
        'content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:test</dc:identifier>
    <dc:title>Il Grande Gatsby</dc:title>
    <dc:creator>F. Scott Fitzgerald</dc:creator>
    <dc:language>it</dc:language>
    <dc:publisher>Scribner</dc:publisher>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`
      );

      folder.file(
        'ch1.xhtml',
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Ch1</title></head>
<body><p>Content</p></body>
</html>`
      );

      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
      const file = new File([blob], 'test.epub', { type: 'application/epub+zip' });

      const metadata = await epubService.extractMetadataFromEpub(file);
      expect(metadata.title).toBe('Il Grande Gatsby');
      expect(metadata.author).toBe('F. Scott Fitzgerald');
      expect(metadata.language).toBe('it');
      expect(metadata.publisher).toBe('Scribner');
    });
  });

  describe('TXT → CSV Conversion', () => {
    it('should convert comma-delimited text to CSV', async () => {
      const content = 'name,age,city\nAlice,30,Rome\nBob,25,Milan';
      const file = new File([content], 'data.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.CSV);

      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe('text/csv');
      expect(result.fileName).toBe('data.csv');

      const csv = await result.blob?.text();
      expect(csv).toContain('name,age,city');
      expect(csv).toContain('Alice,30,Rome');
    });

    it('should convert tab-delimited text to CSV', async () => {
      const content = 'name\tage\nAlice\t30\nBob\t25';
      const file = new File([content], 'data.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.CSV);

      expect(result.success).toBeTrue();
      const csv = await result.blob?.text();
      expect(csv).toContain('name,age');
      expect(csv).toContain('Alice,30');
    });

    it('should convert semicolon-delimited text to CSV', async () => {
      const content = 'nome;età;città\nAlice;30;Roma\nBob;25;Milano';
      const file = new File([content], 'data.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.CSV);

      expect(result.success).toBeTrue();
      const csv = await result.blob?.text();
      expect(csv).toContain('nome');
      expect(csv).toContain('Alice');
    });

    it('should quote values containing commas in output CSV', async () => {
      const content = 'name\taddress\nAlice\t"Rome, Italy"\nBob\tMilan';
      const file = new File([content], 'data.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.CSV);

      expect(result.success).toBeTrue();
      const csv = await result.blob?.text();
      expect(csv).toContain('"Rome, Italy"');
    });

    it('should fail on empty text', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });
      const result = await service.convert(file, ConversionFormat.TXT, ConversionFormat.CSV);

      expect(result.success).toBeFalse();
    });

    it('should block preflight for single-line text', async () => {
      const file = new File(['just one line'], 'single.txt', { type: 'text/plain' });
      const preflight = await service.validateConversion(
        file,
        ConversionFormat.TXT,
        ConversionFormat.CSV
      );

      expect(preflight.blocking).toBeTrue();
      expect(preflight.messageKey).toBe('CONVERSION_VALIDATION.TXT_NO_TABULAR_STRUCTURE');
    });

    it('should warn preflight for text without consistent delimiter', async () => {
      const content = 'Hello world\nThis is a test\nNo delimiters here';
      const file = new File([content], 'prose.txt', { type: 'text/plain' });
      const preflight = await service.validateConversion(
        file,
        ConversionFormat.TXT,
        ConversionFormat.CSV
      );

      expect(preflight.blocking).toBeFalse();
      expect(preflight.severity).toBe('warning');
      expect(preflight.messageKey).toBe('CONVERSION_VALIDATION.TXT_DELIMITER_UNCERTAIN');
    });

    it('should pass preflight for well-delimited text with best-effort warning', async () => {
      const content = 'name,age\nAlice,30\nBob,25';
      const file = new File([content], 'data.txt', { type: 'text/plain' });
      const preflight = await service.validateConversion(
        file,
        ConversionFormat.TXT,
        ConversionFormat.CSV
      );

      expect(preflight.blocking).toBeFalse();
      expect(preflight.severity).toBe('warning');
      expect(preflight.messageKey).toBe('CONVERSION_VALIDATION.BEST_EFFORT');
    });
  });

  describe('CSV → MD/PDF Conversions', () => {
    it('should convert CSV to Markdown table', async () => {
      const csvContent = 'name,age\nAlice,30\nBob,25';
      const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe('text/markdown');
      expect(result.fileName).toBe('data.md');

      const md = await result.blob?.text();
      expect(md).toContain('| name | age |');
      expect(md).toContain('| --- | --- |');
      expect(md).toContain('| Alice | 30 |');
      expect(md).toContain('| Bob | 25 |');
    });

    it('should escape pipe characters in Markdown table cells', async () => {
      const csvContent = 'expr,result\n"a | b",true';
      const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.MD);

      expect(result.success).toBeTrue();
      const md = await result.blob?.text();
      expect(md).toContain('a \\| b');
    });

    it('should convert CSV to PDF via HTML pipeline', async () => {
      pdfServiceSpy.createPdfFromHtml.and.resolveTo(new Uint8Array([1, 2, 3]));

      const csvContent = 'name,age\nAlice,30';
      const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.PDF);

      expect(result.success).toBeTrue();
      expect(result.mimeType).toBe('application/pdf');
      expect(result.fileName).toBe('data.pdf');
      expect(pdfServiceSpy.createPdfFromHtml).toHaveBeenCalled();
    });

    it('should warn preflight for CSV → PDF (multi-step)', async () => {
      const csvContent = 'name,age\nAlice,30';
      const file = new File([csvContent], 'data.csv', { type: 'text/csv' });
      const preflight = await service.validateConversion(
        file,
        ConversionFormat.CSV,
        ConversionFormat.PDF
      );

      expect(preflight.blocking).toBeFalse();
      expect(preflight.severity).toBe('warning');
      expect(preflight.messageKey).toBe('CONVERSION_VALIDATION.MULTI_STEP_REVIEW');
    });

    it('should handle empty CSV data for MD producing empty output', async () => {
      const csvContent = 'name,age';
      const file = new File([csvContent], 'empty.csv', { type: 'text/csv' });
      const result = await service.convert(file, ConversionFormat.CSV, ConversionFormat.MD);

      expect(result.success).toBeTrue();
    });
  });

  describe('XLSX → MD/PDF Conversions', () => {
    it('should list MD as target for XLSX', () => {
      const targets = service.getAvailableTargetFormats(ConversionFormat.XLSX);
      expect(targets).toContain(ConversionFormat.MD);
      expect(targets).toContain(ConversionFormat.PDF);
    });

    it('should list MD and PDF as targets for CSV', () => {
      const targets = service.getAvailableTargetFormats(ConversionFormat.CSV);
      expect(targets).toContain(ConversionFormat.MD);
      expect(targets).toContain(ConversionFormat.PDF);
    });

    it('should list CSV as target for TXT', () => {
      const targets = service.getAvailableTargetFormats(ConversionFormat.TXT);
      expect(targets).toContain(ConversionFormat.CSV);
    });

    it('should warn preflight for XLSX → PDF (multi-step)', async () => {
      const file = new File([new ArrayBuffer(10)], 'data.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const preflight = await service.validateConversion(
        file,
        ConversionFormat.XLSX,
        ConversionFormat.PDF
      );

      expect(preflight.blocking).toBeFalse();
      expect(preflight.severity).toBe('warning');
      expect(preflight.messageKey).toBe('CONVERSION_VALIDATION.MULTI_STEP_REVIEW');
    });
  });
});
