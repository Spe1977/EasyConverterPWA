import { TestBed } from '@angular/core/testing';
import { OcrService } from './ocr.service';

// Local OcrResult type for tests to avoid module path issues
interface OcrResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

describe('OcrService', () => {
  let service: OcrService;
  let mockWorker: jasmine.SpyObj<Worker>;
  let originalTimeout: number;

  beforeEach(() => {
    // Increase timeout for async operations
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

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
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
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

    it('should handle worker initialization failure', async () => {
      // Create a new mock worker for this test
      const newMockWorker = jasmine.createSpyObj<Worker>('Worker', ['postMessage', 'terminate']);
      (window as any).Worker = jasmine.createSpy('Worker').and.returnValue(newMockWorker);

      const newService = new OcrService();

      // Try to recognize - will auto-initialize first
      const recognizePromise = newService.recognizeText('data:image/png;base64,ABC');

      // Simulate initialization error
      setTimeout(() => {
        if (newMockWorker.onmessage) {
          (newMockWorker.onmessage as any)({
            data: { type: 'error', payload: { error: 'Failed to load Tesseract' } },
          });
        }
      }, 10);

      try {
        await recognizePromise;
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to load Tesseract');
      }

      newService.terminate();
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

      let callCount = 0;
      const expectedResults = [
        { text: 'Text 1', confidence: 90 },
        { text: 'Text 2', confidence: 85 },
        { text: 'Text 3', confidence: 88 },
      ];

      // Mock postMessage to respond immediately when called
      mockWorker.postMessage.and.callFake((message: any) => {
        if (message.type === 'recognize' && mockWorker.onmessage) {
          const result = expectedResults[callCount++];
          setTimeout(() => {
            (mockWorker.onmessage as any)({
              data: { type: 'result', payload: result },
            });
          }, 0);
        }
      });

      const results = await service.recognizeMultiple(images);

      expect(results.length).toBe(3);
      expect(results[0].text).toBe('Text 1');
      expect(results[1].text).toBe('Text 2');
      expect(results[2].text).toBe('Text 3');
    });

    it('should handle errors in batch processing', async () => {
      const images = ['data:image/png;base64,img1', 'data:image/png;base64,img2'];

      let callCount = 0;

      // Mock postMessage to respond with success then error
      mockWorker.postMessage.and.callFake((message: any) => {
        if (message.type === 'recognize' && mockWorker.onmessage) {
          setTimeout(() => {
            if (callCount === 0) {
              (mockWorker.onmessage as any)({
                data: { type: 'result', payload: { text: 'Text 1', confidence: 90 } },
              });
            } else {
              (mockWorker.onmessage as any)({
                data: { type: 'error', payload: { error: 'Processing failed' } },
              });
            }
            callCount++;
          }, 0);
        }
      });

      const results = await service.recognizeMultiple(images);

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
