import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ConversionFormat, SUPPORTED_FORMATS, FormatInfo } from '@core/models/conversion-format';

/**
 * Component per selezionare il formato sorgente e destinazione
 * Filtra automaticamente i formati disponibili in base alla sorgente
 */
@Component({
  selector: 'app-format-selector',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './format-selector.component.html',
  styleUrls: ['./format-selector.component.scss']
})
export class FormatSelectorComponent implements OnInit {
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
  allFormats = computed(() => SUPPORTED_FORMATS);

  sourceFormats = computed(() => {
    return SUPPORTED_FORMATS;
  });

  targetFormats = computed(() => {
    const available = this.availableTargets();
    if (available.length > 0) {
      return SUPPORTED_FORMATS.filter(f => available.includes(f.format));
    }
    return SUPPORTED_FORMATS;
  });

  // Grouped formats by category
  groupedSourceFormats = computed(() => this.groupByCategory(this.sourceFormats()));
  groupedTargetFormats = computed(() => this.groupByCategory(this.targetFormats()));

  ngOnInit(): void {
    this.selectedSource.set(this.sourceFormat());
    this.selectedTarget.set(this.targetFormat());
  }

  /**
   * Raggruppa i formati per categoria
   */
  private groupByCategory(formats: FormatInfo[]): Record<string, FormatInfo[]> {
    return formats.reduce((acc, format) => {
      const category = format.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(format);
      return acc;
    }, {} as Record<string, FormatInfo[]>);
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
    return SUPPORTED_FORMATS.find(f => f.format === format) || null;
  }

  /**
   * Ottieni label categoria
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'document': 'Documents',
      'spreadsheet': 'Spreadsheets',
      'pdf': 'PDF',
      'image': 'Images',
      'ebook': 'E-books'
    };
    return labels[category] || category;
  }

  /**
   * Ottieni chiavi oggetto (per template)
   */
  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}
