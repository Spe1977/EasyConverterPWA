import { TestBed } from '@angular/core/testing';
import { ImageService } from './image.service';

describe('ImageService', () => {
  let service: ImageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get dimensions from file', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const file = new File([blob], 'test.png', { type: 'image/png' });
    const dimensions = await service.getImageDimensions(file);
    expect(dimensions.width).toBe(100);
    expect(dimensions.height).toBe(50);
  });
});
