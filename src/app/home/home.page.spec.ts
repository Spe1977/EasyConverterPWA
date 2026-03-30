import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { TranslateLoader, TranslateModule, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { HomePage } from './home.page';
import { ConversionFormat } from '@core/models/conversion-format';
import { ConversionResult } from '@core/models/conversion-result';
import { ConverterService } from '@core/services/converter.service';
import { FileSystemService } from '@core/services/file-system.service';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation(_: string): Observable<TranslationObject> {
    return of({});
  }
}

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let converterServiceSpy: jasmine.SpyObj<ConverterService>;
  let fileSystemServiceSpy: jasmine.SpyObj<FileSystemService>;

  beforeEach(async () => {
    converterServiceSpy = jasmine.createSpyObj('ConverterService', [
      'detectFormat',
      'detectFormatFromContent',
      'getAvailableTargetFormats',
      'getConversionSupport',
      'validateConversion',
      'getStructuredDataExportProfile',
      'convert',
    ]);
    converterServiceSpy.detectFormat.and.returnValue(ConversionFormat.TXT);
    converterServiceSpy.detectFormatFromContent.and.resolveTo(ConversionFormat.TXT);
    converterServiceSpy.getAvailableTargetFormats.and.returnValue([ConversionFormat.PDF]);
    converterServiceSpy.getConversionSupport.and.returnValue({
      target: ConversionFormat.PDF,
      reliability: 'structured',
    });
    converterServiceSpy.validateConversion.and.resolveTo({
      reliability: 'structured',
      blocking: false,
      severity: null,
      messageKey: null,
    });
    converterServiceSpy.getStructuredDataExportProfile.and.resolveTo({
      collectionPaths: ['payload.items'],
      defaultOptions: {
        collectionPath: null,
        primitiveArrayStrategy: 'join',
        columnNaming: 'dot',
      },
    });
    converterServiceSpy.convert.and.resolveTo({
      success: true,
      fileName: 'converted.pdf',
      blob: new Blob(['converted']),
      mimeType: 'application/pdf',
      size: 9,
      duration: 1500,
    } satisfies ConversionResult);

    fileSystemServiceSpy = jasmine.createSpyObj('FileSystemService', [
      'formatFileSize',
      'saveFile',
      'shareFile',
      'readFileAsText',
      'readFileAsDataURL',
    ]);
    fileSystemServiceSpy.formatFileSize.and.callFake((size: number) => `${size} B`);
    fileSystemServiceSpy.readFileAsText.and.resolveTo('line one\nline two');
    fileSystemServiceSpy.readFileAsDataURL.and.resolveTo('data:image/png;base64,abc');
    fileSystemServiceSpy.saveFile.and.resolveTo(null);
    fileSystemServiceSpy.shareFile.and.resolveTo();

    const toastControllerSpy = jasmine.createSpyObj('ToastController', ['create']);
    toastControllerSpy.create.and.resolveTo({
      present: async () => undefined,
    });
    const alertControllerSpy = jasmine.createSpyObj('AlertController', ['create']);
    alertControllerSpy.create.and.resolveTo({
      present: async () => undefined,
    });

    await TestBed.configureTestingModule({
      declarations: [HomePage],
      imports: [
        IonicModule.forRoot(),
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: FakeTranslateLoader,
          },
        }),
      ],
      providers: [
        { provide: ConverterService, useValue: converterServiceSpy },
        { provide: FileSystemService, useValue: fileSystemServiceSpy },
        { provide: ToastController, useValue: toastControllerSpy },
        { provide: AlertController, useValue: alertControllerSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use detected content format when it differs from extension', async () => {
    converterServiceSpy.detectFormat.and.returnValue(ConversionFormat.TXT);
    converterServiceSpy.detectFormatFromContent.and.resolveTo(ConversionFormat.JSON);
    const file = new File(['{"hello":"world"}'], 'sample.txt', { type: 'text/plain' });

    await component.onFileSelected(file);

    expect(component.sourceFormat()).toBe(ConversionFormat.JSON);
    expect(component.availableTargets()).toEqual([ConversionFormat.PDF]);
    expect(component.detectedFormatHint()).toBeTruthy();
  });

  it('should build a text preview for previewable formats', async () => {
    const file = new File(['line one\nline two'], 'sample.txt', { type: 'text/plain' });

    await component.onFileSelected(file);

    expect(fileSystemServiceSpy.readFileAsText).toHaveBeenCalledWith(file);
    expect(component.filePreview()?.kind).toBe('text');
    expect(component.filePreview()?.content).toContain('line one');
    expect(component.filePreview()?.lineCount).toBe(2);
  });

  it('should block conversion when preflight validation fails', async () => {
    converterServiceSpy.detectFormat.and.returnValue(ConversionFormat.JSON);
    converterServiceSpy.detectFormatFromContent.and.resolveTo(ConversionFormat.JSON);
    converterServiceSpy.getConversionSupport.and.returnValue({
      target: ConversionFormat.PDF,
      reliability: 'requires-uniform-data',
    });
    converterServiceSpy.validateConversion.and.resolveTo({
      reliability: 'requires-uniform-data',
      blocking: true,
      severity: 'danger',
      messageKey: 'CONVERSION_VALIDATION.JSON_UNIFORM_KEYS_REQUIRED',
    });
    const file = new File([JSON.stringify([{ name: 'Ada' }, { city: 'Rome' }])], 'sample.json', {
      type: 'application/json',
    });

    await component.onFileSelected(file);
    component.onTargetFormatChange(ConversionFormat.PDF);

    await fixture.whenStable();

    expect(component.preflightBlocking()).toBeTrue();
    expect(component.canConvert()).toBeFalse();
    expect(component.preflightMessage()).toBe('CONVERSION_VALIDATION.JSON_UNIFORM_KEYS_REQUIRED');
    expect(component.qualityFeedback()?.tone).toBe('risk');
  });

  it('should pass structured data options to preflight validation', async () => {
    converterServiceSpy.detectFormat.and.returnValue(ConversionFormat.JSON);
    converterServiceSpy.detectFormatFromContent.and.resolveTo(ConversionFormat.JSON);
    converterServiceSpy.getAvailableTargetFormats.and.returnValue([ConversionFormat.CSV]);
    converterServiceSpy.getConversionSupport.and.returnValue({
      target: ConversionFormat.CSV,
      reliability: 'structured',
    });
    const file = new File(
      [JSON.stringify({ payload: { items: [{ name: 'Ada' }] } })],
      'sample.json',
      {
        type: 'application/json',
      }
    );

    await component.onFileSelected(file);
    component.onTargetFormatChange(ConversionFormat.CSV);
    component.onStructuredDataCollectionPathChange('payload.items');
    component.onStructuredDataPrimitiveArrayStrategyChange('json');
    component.onStructuredDataColumnNamingChange('snake_case');

    await fixture.whenStable();

    expect(converterServiceSpy.validateConversion).toHaveBeenCalledWith(
      file,
      ConversionFormat.JSON,
      ConversionFormat.CSV,
      jasmine.objectContaining({
        structuredData: {
          collectionPath: 'payload.items',
          primitiveArrayStrategy: 'json',
          columnNaming: 'snake_case',
        },
      })
    );
  });

  it('should store feedback about the last successful conversion', async () => {
    const file = new File(['hello'], 'sample.txt', { type: 'text/plain' });

    await component.onFileSelected(file);
    component.onTargetFormatChange(ConversionFormat.PDF);
    await fixture.whenStable();

    await component.convert();

    expect(converterServiceSpy.convert).toHaveBeenCalled();
    expect(component.lastConversionFeedback()?.fileName).toBe('converted.pdf');
    expect(component.lastConversionFeedback()?.outputSize).toBe('9 B');
    expect(component.lastConversionFeedback()?.duration).toBe('1.50s');
  });
});
