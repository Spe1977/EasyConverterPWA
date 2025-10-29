import { TestBed } from '@angular/core/testing';
import { ConverterService } from './converter.service';
import { PdfService } from './pdf.service';
import { ImageService } from './image.service';
import { ConversionFormat } from '../models/conversion-format';

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
  });

  describe('TXT Conversions', () => {
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

    it('should handle PDF service errors', async () => {
      pdfServiceSpy.createPdfFromText.and.returnValue(
        Promise.reject(new Error('PDF creation failed'))
      );

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
        90
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
        85
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
});
