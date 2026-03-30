import { Component, input, output, signal, computed, effect, inject } from '@angular/core';

import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ConversionFormat,
  ConversionReliability,
  SUPPORTED_FORMATS,
  FormatInfo,
} from '@core/models/conversion-format';
import { ConverterService } from '@core/services/converter.service';

/**
 * Component per selezionare il formato sorgente e destinazione
 * Filtra automaticamente i formati disponibili in base alla sorgente
 */
@Component({
  selector: 'app-format-selector',
  standalone: true,
  imports: [IonicModule, TranslateModule],
  templateUrl: './format-selector.component.html',
  styleUrls: ['./format-selector.component.scss'],
})
export class FormatSelectorComponent {
  private translate = inject(TranslateService);
  private converterService = inject(ConverterService);

  // Inputs
  sourceFormat = input<ConversionFormat | null>(null);
  targetFormat = input<ConversionFormat | null>(null);
  availableTargets = input<ConversionFormat[]>([]);
  mode = input<'source' | 'target' | 'both'>('both');

  // Outputs
  sourceFormatChange = output<ConversionFormat>();
  targetFormatChange = output<ConversionFormat>();

  // State
  selectedSource = signal<ConversionFormat | null>(null);
  selectedTarget = signal<ConversionFormat | null>(null);
  showSourceModal = signal(false);
  showTargetModal = signal(false);

  // Computed
  readonly sourceFormats = SUPPORTED_FORMATS;

  targetFormats = computed(() => {
    const available = this.availableTargets();
    if (available.length > 0) {
      return SUPPORTED_FORMATS.filter((f) => available.includes(f.format));
    }
    return SUPPORTED_FORMATS;
  });

  // Grouped formats by category
  readonly groupedSourceFormats = this.groupByCategory(this.sourceFormats);
  groupedTargetFormats = computed(() => this.groupByCategory(this.targetFormats()));

  constructor() {
    effect(() => {
      this.selectedSource.set(this.sourceFormat());
    });
    effect(() => {
      this.selectedTarget.set(this.targetFormat());
    });
  }

  /**
   * Raggruppa i formati per categoria
   */
  private groupByCategory(formats: FormatInfo[]): Record<string, FormatInfo[]> {
    return formats.reduce(
      (acc, format) => {
        const category = format.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(format);
        return acc;
      },
      {} as Record<string, FormatInfo[]>
    );
  }

  /**
   * Apri modal selezione formato sorgente
   */
  openSourceModal(): void {
    if (this.mode() === 'target') return;
    this.showSourceModal.set(true);
  }

  /**
   * Apri modal selezione formato destinazione
   */
  openTargetModal(): void {
    if (this.mode() === 'source') return;
    this.showTargetModal.set(true);
  }

  /**
   * Seleziona formato sorgente
   */
  selectSource(format: ConversionFormat): void {
    this.selectedSource.set(format);
    this.sourceFormatChange.emit(format);
    this.showSourceModal.set(false);
  }

  /**
   * Seleziona formato destinazione
   */
  selectTarget(format: ConversionFormat): void {
    this.selectedTarget.set(format);
    this.targetFormatChange.emit(format);
    this.showTargetModal.set(false);
  }

  /**
   * Ottieni informazioni formato dalla enum
   */
  getFormatInfo(format: ConversionFormat | null): FormatInfo | null {
    if (!format) return null;
    return SUPPORTED_FORMATS.find((f) => f.format === format) || null;
  }

  /**
   * Ottieni label categoria tradotta
   */
  getCategoryLabel(category: string): string {
    const categoryMap: Record<string, string> = {
      document: 'DOCUMENT',
      spreadsheet: 'DATA',
      pdf: 'DOCUMENT',
      image: 'IMAGE',
      ebook: 'DOCUMENT',
      text: 'TEXT',
      data: 'DATA',
    };
    const translationKey = categoryMap[category] || 'OTHER';
    return this.translate.instant(`FORMAT_CATEGORIES.${translationKey}`);
  }

  /**
   * Ottieni chiavi oggetto (per template)
   */
  objectKeys(obj: Record<string, FormatInfo[]>): string[] {
    return Object.keys(obj);
  }

  getReliability(
    source: ConversionFormat | null,
    target: ConversionFormat
  ): ConversionReliability | null {
    return this.converterService.getConversionSupport(source, target)?.reliability ?? null;
  }

  getReliabilityLabel(reliability: ConversionReliability | null): string {
    if (!reliability) return '';
    return this.translate.instant(`CONVERSION_RELIABILITY.${reliability.toUpperCase()}`);
  }
}
