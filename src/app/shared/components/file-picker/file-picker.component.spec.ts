import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, TranslateModule, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { FilePickerComponent } from './file-picker.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation(_: string): Observable<TranslationObject> {
    return of({});
  }
}

describe('FilePickerComponent', () => {
  let component: FilePickerComponent;
  let fixture: ComponentFixture<FilePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FilePickerComponent,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: FakeTranslateLoader,
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FilePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should clear both UI state and native input value on reset', () => {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    component.selectedFileName.set('sample.txt');
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\sample.txt',
    });

    component.reset();

    expect(component.selectedFileName()).toBeNull();
    expect(input.value).toBe('');
  });
});
