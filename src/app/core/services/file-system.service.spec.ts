import { TestBed } from '@angular/core/testing';
import { FileSystemService } from './file-system.service';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileSystemService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect platform type', () => {
    const isNative = service.isNative;
    expect(typeof isNative).toBe('boolean');
  });

  it('should read file as text', async () => {
    const content = 'Hello World';
    const file = new File([content], 'test.txt', { type: 'text/plain' });
    const result = await service.readFileAsText(file);
    expect(result).toBe(content);
  });

  it('should read file as ArrayBuffer', async () => {
    const file = new File(['data'], 'test.bin');
    const result = await service.readFileAsArrayBuffer(file);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('should format file sizes', () => {
    expect(service.formatFileSize(0)).toBe('0 B');
    expect(service.formatFileSize(1024)).toBe('1.0 KB');
    expect(service.formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('should validate file size', () => {
    const file = new File(['test'], 'test.txt');
    expect(service.validateFileSize(file, 1024)).toBeTrue();
  });
});
