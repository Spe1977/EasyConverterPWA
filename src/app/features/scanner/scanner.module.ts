import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ScannerRoutingModule } from './scanner-routing.module';
import { ScannerPage } from './scanner.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ScannerRoutingModule, ScannerPage],
})
export class ScannerModule {}
