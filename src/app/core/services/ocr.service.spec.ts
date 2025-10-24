import { TestBed } from '@angular/core/testing';
import { OcrService } from './ocr.service';
import { OcrResult } from '@core/models/scan-options';

describe('OcrService', () => {
  let service: OcrService;
  let mockWorker: jasmine.SpyObj<Worker>;

  beforeEach(() => {
    // Mock Worker
    mockWorker = jasmine.createSpyObj<Worker>('Worker', ['postMessage', 'terminate']);

    // Mock Worker constructor
    spyOn(window as any, 'Worker').and.returnValue(mockWorker);

    TestBed.configureTestingModule({
      providers: [OcrService],
    });

    service = TestBed.inject(OcrService);
  });

  afterEach(() => {
    service.terminate();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Supported Languages', () => {
    it('should return list of supported languages', () => {
      const languages = service.getSupportedLanguages();
      expect(languages.length).toBe(8);
      expect(languages[0]).toEqual({ code: 'ita', name: 'Italian' });
      expect(languages[1]).toEqual({ code: 'eng', name: 'English' });
    });

    it('should verify Italian is supported', () => {
      expect(service.isSupportedLanguage('ita')).toBeTrue();
    });

    it('should verify English is supported', () => {
      expect(service.isSupportedLanguage('eng')).toBeTrue();
    });

    it('should verify unsupported language returns false', () => {
      expect(service.isSupportedLanguage('xyz')).toBeFalse();
    });

    it('should verify all supported languages', () => {
      const supportedCodes = ['ita', 'eng', 'fra', 'deu', 'spa', 'por', 'rus', 'chi_sim'];
      supportedCodes.forEach((code) => {
        expect(service.isSupportedLanguage(code)).toBeTrue();
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize worker with default language', async () => {
      const initPromise = service.initialize();

      // Simulate worker ready message
      const onmessageHandler = mockWorker.onmessage as any;
      expect(onmessageHandler).toBeDefined();

      onmessageHandler({ data: { type: 'ready' } });

      await expectAsync(initPromise).toBeResolved();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'init',
        payload: { languages: ['ita'] },
      });
    });

    it('should initialize worker with custom languages', async () => {
      const initPromise = service.initialize(['eng', 'fra']);

      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });

      await expectAsync(initPromise).toBeResolved();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'init',
        payload: { languages: ['eng', 'fra'] },
      });
    });

    it('should handle initialization errors', async () => {
      const initPromise = service.initialize();

      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({
        data: {
          type: 'error',
          payload: { error: 'Failed to load Tesseract' },
        },
      });

      await expectAsync(initPromise).toBeRejectedWithError('Failed to load Tesseract');
    });

    it('should not reinitialize with same languages', async () => {
      // First initialization
      const initPromise1 = service.initialize(['ita']);
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
      await initPromise1;

      mockWorker.postMessage.calls.reset();

      // Second initialization with same language
      await service.initialize(['ita']);

      // Should not call postMessage again
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Text Recognition', () => {
    beforeEach(async () => {
      // Initialize service before each test
      const initPromise = service.initialize();
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
      await initPromise;
    });

    it('should recognize text from base64 string', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const recognizePromise = service.recognizeText(base64Image);

      // Simulate worker result
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({
        data: {
          type: 'result',
          payload: {
            text: 'Hello World',
            confidence: 95.5,
          },
        },
      });

      const result: OcrResult = await recognizePromise;

      expect(result.success).toBeTrue();
      expect(result.text).toBe('Hello World');
      expect(result.confidence).toBe(95.5);
    });

    it('should recognize text from Blob', async () => {
      const blob = new Blob(['fake-image-data'], { type: 'image/png' });
      const recognizePromise = service.recognizeText(blob);

      // Wait for blob to base64 conversion then simulate result
      setTimeout(() => {
        const onmessageHandler = mockWorker.onmessage as any;
        onmessageHandler({
          data: {
            type: 'result',
            payload: {
              text: 'Test Document',
              confidence: 88.2,
            },
          },
        });
      }, 10);

      const result: OcrResult = await recognizePromise;

      expect(result.success).toBeTrue();
      expect(result.text).toBe('Test Document');
      expect(result.confidence).toBe(88.2);
    });

    it('should recognize text with custom language', async () => {
      const base64Image = 'data:image/png;base64,ABC123';
      const recognizePromise = service.recognizeText(base64Image, { language: 'eng' });

      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({
        data: {
          type: 'result',
          payload: {
            text: 'English text',
            confidence: 92.0,
          },
        },
      });

      await recognizePromise;

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'recognize',
        payload: jasmine.objectContaining({
          language: 'eng',
        }),
      });
    });

    it('should emit progress events', (done) => {
      const base64Image = 'data:image/png;base64,ABC123';

      const progressValues: number[] = [];
      service.progress$.subscribe((progress) => {
        progressValues.push(progress.progress);
      });

      const recognizePromise = service.recognizeText(base64Image);

      const onmessageHandler = mockWorker.onmessage as any;

      // Simulate progress updates
      onmessageHandler({
        data: { type: 'progress', payload: { progress: 0.3 } },
      });

      onmessageHandler({
        data: { type: 'progress', payload: { progress: 0.6 } },
      });

      onmessageHandler({
        data: {
          type: 'result',
          payload: { text: 'Done', confidence: 90 },
        },
      });

      recognizePromise.then(() => {
        expect(progressValues.length).toBeGreaterThan(0);
        expect(progressValues).toContain(0.3);
        expect(progressValues).toContain(0.6);
        done();
      });
    });

    it('should handle OCR errors', async () => {
      const base64Image = 'data:image/png;base64,invalid';
      const recognizePromise = service.recognizeText(base64Image);

      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({
        data: {
          type: 'error',
          payload: { error: 'Invalid image format' },
        },
      });

      const result: OcrResult = await recognizePromise;

      expect(result.success).toBeFalse();
      expect(result.error).toBe('Invalid image format');
    });

    it('should throw error if worker not initialized', async () => {
      const newService = new OcrService();

      try {
        await newService.recognizeText('data:image/png;base64,ABC');
        fail('Should have thrown an error');
      } catch (error: any) {
        // Worker initialization will fail because we can't mock Worker in this context
        expect(error).toBeDefined();
      }
    });
  });

  describe('Multiple Image Recognition', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
      await initPromise;
    });

    it('should process multiple images sequentially', async () => {
      const images = [
        'data:image/png;base64,img1',
        'data:image/png;base64,img2',
        'data:image/png;base64,img3',
      ];

      const resultsPromise = service.recognizeMultiple(images);

      // Simulate results for each image
      const onmessageHandler = mockWorker.onmessage as any;

      // Image 1
      setTimeout(() => {
        onmessageHandler({
          data: { type: 'result', payload: { text: 'Text 1', confidence: 90 } },
        });
      }, 10);

      // Image 2
      setTimeout(() => {
        onmessageHandler({
          data: { type: 'result', payload: { text: 'Text 2', confidence: 85 } },
        });
      }, 20);

      // Image 3
      setTimeout(() => {
        onmessageHandler({
          data: { type: 'result', payload: { text: 'Text 3', confidence: 88 } },
        });
      }, 30);

      const results = await resultsPromise;

      expect(results.length).toBe(3);
      expect(results[0].text).toBe('Text 1');
      expect(results[1].text).toBe('Text 2');
      expect(results[2].text).toBe('Text 3');
    });

    it('should handle errors in batch processing', async () => {
      const images = ['data:image/png;base64,img1', 'data:image/png;base64,img2'];

      const resultsPromise = service.recognizeMultiple(images);

      const onmessageHandler = mockWorker.onmessage as any;

      // Image 1 - success
      setTimeout(() => {
        onmessageHandler({
          data: { type: 'result', payload: { text: 'Text 1', confidence: 90 } },
        });
      }, 10);

      // Image 2 - error
      setTimeout(() => {
        onmessageHandler({
          data: { type: 'error', payload: { error: 'Processing failed' } },
        });
      }, 20);

      const results = await resultsPromise;

      expect(results.length).toBe(2);
      expect(results[0].success).toBeTrue();
      expect(results[1].success).toBeFalse();
      expect(results[1].error).toBe('Processing failed');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should terminate worker', async () => {
      const initPromise = service.initialize();
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
      await initPromise;

      service.terminate();

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'terminate' });
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should complete progress subject on destroy', () => {
      let completed = false;
      service.progress$.subscribe({
        complete: () => {
          completed = true;
        },
      });

      service.ngOnDestroy();

      expect(completed).toBeTrue();
    });

    it('should handle terminate when worker is null', () => {
      const newService = new OcrService();
      expect(() => newService.terminate()).not.toThrow();
    });
  });

  describe('Progress Observable', () => {
    it('should emit initialization progress', (done) => {
      const progressStates: string[] = [];

      service.progress$.subscribe((progress) => {
        if (progress.status) {
          progressStates.push(progress.status);
        }
      });

      service.initialize().then(() => {
        expect(progressStates).toContain('initializing');
        done();
      });

      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
    });

    it('should emit recognition progress', async () => {
      // Initialize first
      const initPromise = service.initialize();
      let onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'ready' } });
      await initPromise;

      const progressStates: string[] = [];
      service.progress$.subscribe((progress) => {
        if (progress.status) {
          progressStates.push(progress.status);
        }
      });

      const recognizePromise = service.recognizeText('data:image/png;base64,test');

      onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({ data: { type: 'progress', payload: { progress: 0.5 } } });
      onmessageHandler({
        data: { type: 'result', payload: { text: 'Done', confidence: 90 } },
      });

      await recognizePromise;

      expect(progressStates).toContain('recognizing');
      expect(progressStates).toContain('OCR completed');
    });

    it('should emit error status on failure', async () => {
      const progressStates: string[] = [];

      service.progress$.subscribe((progress) => {
        if (progress.status) {
          progressStates.push(progress.status);
        }
      });

      const initPromise = service.initialize();
      const onmessageHandler = mockWorker.onmessage as any;
      onmessageHandler({
        data: { type: 'error', payload: { error: 'Init failed' } },
      });

      try {
        await initPromise;
      } catch (error) {
        expect(progressStates).toContain('error');
      }
    });
  });
});
