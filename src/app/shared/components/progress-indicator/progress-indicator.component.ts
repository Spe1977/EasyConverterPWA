import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/**
 * Component per mostrare il progresso della conversione
 * Supporta progress bar e spinner
 */
@Component({
  selector: 'app-progress-indicator',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './progress-indicator.component.html',
  styleUrls: ['./progress-indicator.component.scss']
})
export class ProgressIndicatorComponent {
  // Inputs
  isActive = input<boolean>(false);
  progress = input<number>(0); // 0-100
  message = input<string>('Converting...');
  showProgress = input<boolean>(true); // Se false, mostra solo spinner

  /**
   * Ottieni il valore di progress normalizzato (0-1)
   */
  get normalizedProgress(): number {
    return Math.min(Math.max(this.progress() / 100, 0), 1);
  }

  /**
   * Ottieni il messaggio formattato con percentuale
   */
  get formattedMessage(): string {
    const msg = this.message();
    const prog = this.progress();
    if (this.showProgress() && prog > 0) {
      return `${msg} (${Math.round(prog)}%)`;
    }
    return msg;
  }
}
