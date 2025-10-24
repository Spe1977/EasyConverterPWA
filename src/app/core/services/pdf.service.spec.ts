import { TestBed } from '@angular/core/testing';
import { PdfService } from './pdf.service';

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create PDF from simple text', async () => {
    const text = 'Hello World';
    const pdfBytes = await service.createPdfFromText(text);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
  });

  it('should create PDF with custom font size', async () => {
    const text = 'Custom font size';
    const pdfBytes = await service.createPdfFromText(text, { fontSize: 16 });
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should create PDF from PNG image', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const pdfBytes = await service.createPdfFromImage(blob, 'png');
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should create PDF from JPEG image', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg');
    });
    const pdfBytes = await service.createPdfFromImage(blob, 'jpeg');
    expect(pdfBytes).toBeDefined();
  });

  it('should create PDF from multiple images', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const pdfBytes = await service.createPdfFromImages([blob, blob], 'png');
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(0);
  });

  it('should output valid PDF format', async () => {
    const pdfBytes = await service.createPdfFromText('Test');
    const header = String.fromCharCode(...Array.from(pdfBytes.slice(0, 5)));
    expect(header).toBe('%PDF-');
  });
});
