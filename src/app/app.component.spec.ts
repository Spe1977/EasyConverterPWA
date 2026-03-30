import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { Observable, of } from 'rxjs';

import { AppComponent } from './app.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation(_: string): Observable<TranslationObject> {
    return of({});
  }
}

describe('AppComponent', () => {
  beforeEach(async () => {
    const swUpdateMock = {
      isEnabled: false,
      versionUpdates: NEVER,
      unrecoverable: NEVER,
      checkForUpdate: jasmine.createSpy('checkForUpdate').and.returnValue(Promise.resolve(false)),
      activateUpdate: jasmine.createSpy('activateUpdate').and.returnValue(Promise.resolve()),
    };

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: FakeTranslateLoader,
          },
        }),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [{ provide: SwUpdate, useValue: swUpdateMock }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
