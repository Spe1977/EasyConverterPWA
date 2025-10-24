# Schema delle Conversioni Possibili - PWA Offline (Frontend TypeScript)
## Angular + Ionic + Capacitor + Stencil

> Tutte le conversioni sono eseguibili **100% offline** nel browser usando librerie JavaScript/TypeScript compatibili con PWA mobile-first.

---

## 📚 Librerie JavaScript/TypeScript Utilizzate

### Conversioni Documenti e Dati
- **SheetJS (xlsx)** v0.20.x - Excel/CSV/ODS (⚠️ ODS pieno supporto solo in Pro)
- **PapaParse** v5.x - CSV parsing/generation
- **marked** v12.x - Markdown → HTML
- **turndown** v7.x - HTML → Markdown
- **JSZip** v3.x - Gestione ZIP (per EPUB)

### PDF e Immagini
- **PDF.js** v4.x (Mozilla) - Lettura PDF, rendering, estrazione testo
- **pdf-lib** v1.17.x - Creazione/modifica PDF, embedding immagini
- **jsPDF** v2.x - Generazione PDF (alternativa a pdf-lib)

### Scansione e OCR
- **opencv.js** v4.x - Elaborazione immagini, crop automatico, correzione prospettiva
- **Tesseract.js** v5.x - OCR (riconoscimento testo da immagini)

### Capacitor Plugins
- **@capacitor/camera** - Accesso fotocamera (web fallback con MediaDevices API)
- **@capacitor/filesystem** - Salvataggio file su dispositivo
- **@capacitor/share** - Condivisione file

---

## 🔄 Matrice delle Conversioni Possibili

| DA ↓ / A → | TXT | MD | HTML | CSV | JSON | XLSX | ODS | PDF | PNG/JPG | EPUB |
|------------|-----|----|----|-----|------|------|-----|-----|---------|------|
| **TXT**    | -   | ✅ | ✅  | ⚠️¹ | ❌   | ❌   | ❌  | ✅  | ✅      | ❌   |
| **MD**     | ✅  | -  | ✅  | ❌  | ❌   | ❌   | ❌  | ✅  | ✅      | ❌   |
| **HTML**   | ✅  | ✅ | -   | ⚠️² | ❌   | ⚠️²  | ⚠️² | ✅  | ✅      | ❌   |
| **CSV**    | ✅  | ✅ | ✅  | -   | ✅   | ✅   | ✅³ | ✅  | ✅      | ❌   |
| **JSON**   | ✅  | ✅ | ✅  | ⚠️⁴ | -    | ⚠️⁴  | ⚠️⁴ | ✅  | ✅      | ❌   |
| **XLSX**   | ✅  | ✅ | ✅  | ✅  | ✅   | -    | ✅³ | ✅  | ✅      | ❌   |
| **ODS**    | ✅  | ✅ | ✅  | ✅  | ✅   | ✅³  | -   | ✅  | ✅      | ❌   |
| **PDF**    | ✅⁵ | ✅⁵| ✅⁵ | ❌  | ❌   | ❌   | ❌  | ⚠️⁶ | ✅⁷     | ❌   |
| **PNG/JPG**| ✅⁸ | ✅⁸| ✅⁸ | ❌  | ❌   | ❌   | ❌  | ✅  | ⚠️⁹     | ❌   |
| **EPUB**   | ✅⁵ | ✅⁵| ✅⁵ | ❌  | ❌   | ❌   | ❌  | ✅⁵ | ❌      | -    |
| **SCAN¹⁰** | ✅⁸ | ✅⁸| ✅⁸ | ❌  | ❌   | ❌   | ❌  | ✅  | ✅      | ❌   |

### Legenda Note
- **⚠️¹**: TXT → CSV possibile solo se il testo contiene delimitatori (tab, virgole)
- **⚠️²**: HTML → CSV/XLSX possibile solo se contiene `<table>` HTML
- **⚠️³**: Supporto ODS completo solo con SheetJS Pro (versione community ha limitazioni)
- **⚠️⁴**: JSON → CSV/XLSX possibile solo per array di oggetti con struttura uniforme
- **✅⁵**: Estrazione solo testo (nessuna formattazione, immagini, layout)
- **⚠️⁶**: PDF → PDF per merge, split, rotate, add/remove pages (pdf-lib)
- **✅⁷**: PDF → Immagine con rendering canvas (1 immagine per pagina, intensivo)
- **✅⁸**: Con OCR (Tesseract.js) - accuracy 70-95% in base a qualità immagine
- **⚠️⁹**: Conversioni formato (PNG ↔ JPEG, resize, crop) con Canvas API
- **¹⁰**: SCAN = acquisizione da fotocamera con elaborazione immagine

---

## 📋 Conversioni Dettagliate per Formato

### DA: TXT (Plain Text)
**A:**
- **Markdown** (MD): Wrapping testo con syntax MD
- **HTML**: Wrapping in `<p>`, escape caratteri speciali
- **CSV**: ⚠️ Solo se contiene delimitatori rilevabili
- **PDF**: Embedding testo in documento PDF (jsPDF/pdf-lib)
- **Immagine**: Rendering testo su canvas, export PNG/JPG

---

### DA: Markdown (MD)
**A:**
- **TXT**: Rimozione syntax Markdown
- **HTML**: Parsing con marked.js
- **PDF**: MD → HTML → PDF con jsPDF
- **Immagine**: MD → HTML → Canvas → PNG/JPG

---

### DA: HTML
**A:**
- **TXT**: Estrazione testo (strip tags)
- **Markdown**: Conversione con turndown.js
- **CSV/XLSX**: ⚠️ Solo se contiene `<table>`, parsing DOM
- **PDF**: Rendering HTML → Canvas → PDF o html2pdf.js
- **Immagine**: Rendering HTML → Canvas → PNG/JPG

---

### DA: CSV
**A:**
- **TXT**: Serializzazione plain text
- **Markdown**: Tabelle MD syntax
- **HTML**: Generazione `<table>` HTML
- **JSON**: Array di oggetti con PapaParse
- **XLSX/ODS**: Conversione con SheetJS
- **PDF**: CSV → HTML table → PDF
- **Immagine**: CSV → HTML table → Canvas → PNG/JPG

---

### DA: JSON
**A:**
- **TXT**: `JSON.stringify()` formattato
- **Markdown**: Tabelle MD (se array uniforme)
- **HTML**: Rendering dati come `<table>` o `<pre>`
- **CSV**: ⚠️ Solo array oggetti uniformi (PapaParse)
- **XLSX/ODS**: ⚠️ Solo array oggetti uniformi (SheetJS)
- **PDF**: JSON → HTML → PDF
- **Immagine**: JSON → HTML → Canvas → PNG/JPG

---

### DA: XLSX (Excel)
**A:**
- **TXT/MD/HTML/CSV/JSON**: Tutte con SheetJS
- **ODS**: ⚠️ Con SheetJS Pro (limitazioni in community)
- **PDF**: XLSX → HTML → PDF o XLSX → Canvas → PDF
- **Immagine**: XLSX → HTML table → Canvas → PNG/JPG

---

### DA: ODS (OpenDocument Spreadsheet)
**A:**
- **Tutte le conversioni come XLSX**
- ⚠️ **Nota**: Lettura ODS funziona in SheetJS community, scrittura completa solo in Pro

---

### DA: PDF
**A:**
- **TXT/MD/HTML**: Estrazione testo con PDF.js (no formattazione)
- **Immagine (PNG/JPG)**: Rendering pagine su canvas (1 immagine per pagina)
- **PDF**: Manipolazioni (merge, split, rotate, add/remove pages) con pdf-lib

⚠️ **Limitazioni**:
- Nessuna estrazione layout/formattazione
- PDF → Immagine è intensivo (memoria per PDF multipagina)
- Nessuna conversione a formati strutturati (CSV, XLSX, JSON)

---

### DA: Immagine (PNG, JPEG, WebP)
**A:**
- **PDF**: Embedding immagine in PDF con jsPDF o pdf-lib
- **TXT/MD/HTML**: OCR con Tesseract.js (accuracy 70-95%)
- **Immagini**: Conversioni formato, resize, crop, rotate con Canvas API

⚠️ **Performance OCR**:
- Pesante (2-10s per immagine su mobile)
- Richiede Web Worker per non bloccare UI
- Language data (~2-4MB per lingua)

---

### DA: EPUB
**A:**
- **TXT/MD/HTML**: Unzip con JSZip, parsing XML/XHTML
- **PDF**: Estrazione testo → PDF (solo contenuto testuale)

⚠️ **Limitazioni**:
- Solo testo, no immagini/layout
- EPUB è ZIP con struttura complessa

---

### 📷 DA: Scansione Fotocamera (NUOVA FUNZIONALITÀ)
**Acquisizione documento tramite fotocamera con elaborazione automatica**

**Flusso completo:**
1. **Cattura**: Capacitor Camera API o MediaDevices API (web)
2. **Elaborazione**: opencv.js per:
   - Rilevamento bordi documento
   - Crop automatico
   - Correzione prospettiva
   - Filtri (B/N, contrasto, soglia)
3. **OCR (opzionale)**: Tesseract.js per riconoscimento testo
4. **Export**: Salvataggio nei formati supportati

**A:**
- **Immagine (PNG/JPG)**: Salvataggio diretto dopo elaborazione
- **PDF**: Immagine embedded in PDF (multi-pagina supportato)
- **PDF searchable**: PDF con layer testo invisibile da OCR
- **TXT/MD/HTML**: Testo estratto con OCR

**Implementazione TypeScript/Angular:**
```typescript
// Service per scansione documenti
@Injectable({ providedIn: 'root' })
export class DocumentScannerService {
  
  async scanDocument(): Promise<ScanResult> {
    // 1. Cattura da fotocamera
    const image = await Camera.getPhoto({
      quality: 100,
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl
    });
    
    // 2. Elaborazione con opencv.js
    const processed = await this.processImage(image.dataUrl);
    
    // 3. OCR opzionale
    const text = await this.performOCR(processed);
    
    return { image: processed, text };
  }
  
  private async processImage(dataUrl: string): Promise<string> {
    // Carica immagine in opencv Mat
    // Rileva bordi (Canny edge detection)
    // Trova contorni e identifica documento
    // Trasforma prospettiva
    // Applica filtri (adaptive threshold per B/N)
    // Ritorna base64 elaborato
  }
  
  private async performOCR(imageData: string): Promise<string> {
    const worker = await createWorker('ita'); // Lingua italiana
    const { data: { text } } = await worker.recognize(imageData);
    await worker.terminate();
    return text;
  }
}
```

**Features avanzate:**
- **Multi-pagina**: Scansione sequenziale documenti multi-pagina
- **Batch processing**: Scansione multipla con coda elaborazione
- **Auto-enhance**: Correzione automatica luminosità/contrasto
- **Manual crop**: Adjust manuale bordi se auto-detection fallisce
- **Preview**: Anteprima real-time con overlay bordi rilevati

⚠️ **Considerazioni Performance**:
- opencv.js: ~8-10MB (caricamento lazy con dynamic import)
- Tesseract.js: ~2MB + language data (2-4MB per lingua)
- OCR: 2-10 secondi per immagine su mobile (Web Worker obbligatorio)
- Memoria: Immagini ad alta risoluzione (8-12MP) possono causare out-of-memory

**Ottimizzazioni PWA**:
```typescript
// Lazy loading opencv.js solo quando serve
async loadOpenCV(): Promise<void> {
  if (!this.cvLoaded) {
    await import('opencv.js');
    this.cvLoaded = true;
  }
}

// Web Worker per OCR (non blocca UI)
const ocrWorker = new Worker(new URL('./ocr.worker', import.meta.url));
ocrWorker.postMessage({ image: imageData });
ocrWorker.onmessage = (e) => {
  const extractedText = e.data;
  // Usa il testo estratto
};
```

---

## ❌ Formati NON Supportabili (Offline Frontend)

### DOCX / DOC (Microsoft Word)
- ❌ Scrittura DOCX complessa (richiede backend o libreria commerciale)
- ✅ Lettura limitata possibile con mammoth.js (solo testo/HTML base)

### ODT (OpenDocument Text)
- ❌ Parsing/generazione complesso (XML con ZIP)
- ✅ Possibile con odt2html (solo lettura limitata)

### RTF (Rich Text Format)
- ❌ Nessuna libreria JS robusta

### AZW / MOBI (Amazon Kindle)
- ❌ Formati proprietari, DRM protected

### Immagini RAW (CR2, NEF, ARW)
- ❌ Nessun parser JS disponibile

---

## 🚀 Implementazione in Angular + Ionic + Capacitor

### Architettura Consigliata

```
src/
├── app/
│   ├── core/
│   │   ├── services/
│   │   │   ├── converter.service.ts       # Service principale conversioni
│   │   │   ├── pdf.service.ts             # Gestione PDF
│   │   │   ├── image.service.ts           # Elaborazione immagini
│   │   │   ├── scanner.service.ts         # Scansione documenti
│   │   │   ├── ocr.service.ts             # OCR con Tesseract
│   │   │   └── file-system.service.ts     # Salvataggio file (Capacitor)
│   │   └── models/
│   │       ├── conversion-format.ts       # Enum formati
│   │       ├── conversion-result.ts       # Interface risultati
│   │       └── scan-options.ts            # Opzioni scansione
│   ├── features/
│   │   ├── converter/
│   │   │   ├── converter.page.ts          # Pagina principale
│   │   │   ├── format-selector/           # Component selezione formato
│   │   │   └── conversion-preview/        # Preview risultato
│   │   └── scanner/
│   │       ├── scanner.page.ts            # Pagina scansione
│   │       ├── camera-view/               # Component fotocamera
│   │       └── document-editor/           # Component editing scansione
│   └── shared/
│       └── components/
│           ├── file-picker/               # Component upload file
│           └── progress-indicator/        # Loading conversione
└── workers/
    ├── ocr.worker.ts                      # Web Worker OCR
    └── image-processing.worker.ts         # Web Worker opencv
```

### Service Worker Caching Strategy

```json
// ngsw-config.json
{
  "assetGroups": [
    {
      "name": "libraries",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/assets/libs/opencv.js",
          "/assets/libs/tesseract-core.wasm",
          "/assets/traineddata/*.traineddata.gz"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "converted-files",
      "urls": [],
      "cacheConfig": {
        "maxSize": 50,
        "maxAge": "7d",
        "strategy": "freshness"
      }
    }
  ]
}
```

### Esempio Conversione Component (TypeScript)

```typescript
import { Component, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ConverterService } from '@core/services/converter.service';
import { ScannerService } from '@core/services/scanner.service';
import { ConversionFormat } from '@core/models/conversion-format';

@Component({
  selector: 'app-converter',
  standalone: true,
  templateUrl: './converter.page.html',
  styleUrls: ['./converter.page.scss']
})
export class ConverterPage {
  selectedFile = signal<File | null>(null);
  sourceFormat = signal<ConversionFormat | null>(null);
  targetFormat = signal<ConversionFormat | null>(null);
  converting = signal(false);
  result = signal<Blob | null>(null);
  
  constructor(
    private converter: ConverterService,
    private scanner: ScannerService
  ) {}
  
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
      this.sourceFormat.set(this.detectFormat(input.files[0]));
    }
  }
  
  async scanDocument(): Promise<void> {
    try {
      const scanResult = await this.scanner.scanDocument({
        quality: 100,
        autoEnhance: true,
        detectEdges: true
      });
      
      // Crea file dall'immagine scansionata
      const blob = await fetch(scanResult.image).then(r => r.blob());
      const file = new File([blob], 'scanned-doc.jpg', { type: 'image/jpeg' });
      
      this.selectedFile.set(file);
      this.sourceFormat.set(ConversionFormat.IMAGE);
    } catch (error) {
      console.error('Scan error:', error);
    }
  }
  
  async convert(): Promise<void> {
    const file = this.selectedFile();
    const source = this.sourceFormat();
    const target = this.targetFormat();
    
    if (!file || !source || !target) return;
    
    this.converting.set(true);
    
    try {
      const result = await this.converter.convert(file, source, target);
      this.result.set(result);
      await this.downloadFile(result, target);
    } catch (error) {
      console.error('Conversion error:', error);
    } finally {
      this.converting.set(false);
    }
  }
  
  private detectFormat(file: File): ConversionFormat {
    const ext = file.name.split('.').pop()?.toLowerCase();
    // Mappa estensione → formato
    // Ritorna formato rilevato
  }
  
  private async downloadFile(blob: Blob, format: ConversionFormat): Promise<void> {
    // Usa Capacitor Filesystem su native
    // Usa download link su web
  }
}
```

---

## 📱 Ottimizzazioni PWA Mobile-First

### 1. Performance
- **Lazy loading**: Carica opencv.js e tesseract.js solo quando necessari
- **Web Workers**: OCR e image processing in background thread
- **IndexedDB**: Cache risultati conversioni per riutilizzo
- **Chunking**: Split file grandi in chunks per evitare memory issues

### 2. Offline-First
- Service Worker cache tutte le librerie necessarie
- Conversioni funzionano 100% offline
- Coda conversioni se app va offline durante processing

### 3. Mobile Experience
- Touch gestures per crop manuale
- Preview real-time con overlay bordi documento
- Feedback aptico su Capacitor (vibrazione su scan success)
- Compressione immagini automatica per risparmiare storage

### 4. Progressive Enhancement
```typescript
// Feature detection
if (Capacitor.isNativePlatform()) {
  // Usa Capacitor Camera plugin
  await Camera.getPhoto(...);
} else {
  // Fallback web con MediaDevices API
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
}
```

---

## 📊 Bundle Size Estimates

| Libreria | Dimensione | Strategia Loading |
|----------|-----------|-------------------|
| SheetJS | ~500 KB | Core bundle |
| PapaParse | ~45 KB | Core bundle |
| marked | ~20 KB | Core bundle |
| PDF.js | ~1.5 MB | Lazy load |
| pdf-lib | ~450 KB | Lazy load |
| opencv.js | ~8-10 MB | Lazy load + Cache |
| Tesseract.js | ~2 MB + 2-4 MB/lingua | Lazy load + Cache |

**Total initial bundle**: ~600 KB  
**On-demand**: ~15-20 MB (cached dopo primo utilizzo)

---

## ✅ Checklist Implementazione

- [ ] Setup Angular 20 + Ionic 8 + Capacitor 7
- [ ] Installazione librerie (xlsx, papaparse, marked, turndown, pdf.js, pdf-lib, jspdf)
- [ ] Installazione librerie pesanti lazy (opencv.js, tesseract.js)
- [ ] Service Worker configuration con caching librerie
- [ ] Converter Service con tutti i metodi di conversione
- [ ] Scanner Service con Capacitor Camera + opencv.js
- [ ] OCR Service con Tesseract.js in Web Worker
- [ ] File System Service con Capacitor Filesystem
- [ ] UI Components: file picker, format selector, preview
- [ ] Camera UI con overlay bordi e manual crop
- [ ] Progress indicators per conversioni lunghe
- [ ] Error handling e fallback per librerie non caricate
- [ ] Testing su iOS, Android, Web
- [ ] Performance audit (Lighthouse score 90+)
- [ ] Offline functionality test
- [ ] Multi-language OCR support (ita, eng, ecc.)

---

## 🔗 Risorse e Documentazione

- **SheetJS**: https://docs.sheetjs.com/
- **PDF.js**: https://mozilla.github.io/pdf.js/
- **pdf-lib**: https://pdf-lib.js.org/
- **Tesseract.js**: https://tesseract.projectnaptha.com/
- **opencv.js**: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- **Capacitor Plugins**: https://capacitorjs.com/docs/apis
- **Angular PWA**: https://angular.dev/ecosystem/service-workers
- **Ionic Framework**: https://ionicframework.com/docs

---

**Versione**: 2.0 (Ottobre 2025)  
**Compatibilità**: Angular 20+, Ionic 8+, Capacitor 7+  
**Piattaforme**: iOS 14+, Android 8+ (API 24+), Web (Chrome 90+, Safari 14+, Firefox 88+)
