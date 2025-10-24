import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';

// Import standalone components
import { FilePickerComponent } from '@shared/components/file-picker/file-picker.component';
import { FormatSelectorComponent } from '@shared/components/format-selector/format-selector.component';
import { ProgressIndicatorComponent } from '@shared/components/progress-indicator/progress-indicator.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    // Standalone components
    FilePickerComponent,
    FormatSelectorComponent,
    ProgressIndicatorComponent,
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
