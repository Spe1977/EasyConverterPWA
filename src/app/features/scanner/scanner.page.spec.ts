import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScannerPage } from './scanner.page';
import { IonicModule } from '@ionic/angular';

describe('ScannerPage', () => {
  let component: ScannerPage;
  let fixture: ComponentFixture<ScannerPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScannerPage, IonicModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScannerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with capture step', () => {
    expect(component.currentStep()).toBe('capture');
  });

  it('should have 8 available languages', () => {
    expect(component.availableLanguages.length).toBe(8);
  });

  it('should have italian as default language', () => {
    expect(component.selectedLanguage()).toBe('ita');
  });
});
