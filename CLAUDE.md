# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyConverter is a mobile-first Progressive Web App built with Angular 20, Ionic 8, and Capacitor 7 for offline document conversion. All conversions run 100% client-side in the browser using TypeScript libraries.

**Core functionality**: Convert between 15+ formats (TXT, MD, HTML, RTF, CSV, JSON, XLSX, ODS, YAML, XML, PDF, PNG/JPEG/WEBP, EPUB, Base64) with 120+ conversion combinations.

## Development Commands

### Essential Commands
- `npm start` - Start dev server (default port via Ionic)
- `npm run build` - Production build (outputs to `www/`)
- `npm run build -- --configuration production` - Production build with optimizations
- `npm run watch` - Build in watch mode for development
- `npm test` - Run unit tests with Karma
- `npm test -- --no-watch --browsers=ChromeHeadless` - Run tests once (CI mode)
- `npm run lint` - Lint TypeScript and HTML files with ESLint

### Code Quality
- `npm run format` - Format all source files with Prettier
- `npm run format:check` - Check formatting without modifying files
- `npm run analyze` - Analyze bundle size with webpack-bundle-analyzer

### E2E Testing
- `npm run e2e` - Open Cypress UI for interactive testing
- `npm run e2e:ci` - Run Cypress tests in headless mode (CI)

### Capacitor (Native Mobile)
- `npx cap sync` - Sync web assets to native projects
- `npx cap open ios` - Open iOS project in Xcode
- `npx cap open android` - Open Android project in Android Studio
- `npx cap run android` - Build and run on Android device/emulator
- `npx cap run ios` - Build and run on iOS device/simulator

## Architecture

### Module Structure
This is an **NgModule-based** Angular app (not standalone). The app uses:
- Traditional `@NgModule` declarations with `BrowserModule`, `IonicModule.forRoot()`
- Feature modules with routing (e.g., home module)
- Lazy-loaded routes via `AppRoutingModule`

### Path Aliases
The project uses TypeScript path aliases configured in `tsconfig.json`:
```typescript
@app/*       → src/app/*
@core/*      → src/app/core/*
@shared/*    → src/app/shared/*
@features/*  → src/app/features/*
@env/*       → src/environments/*
```

Always use these aliases for imports instead of relative paths.

### Directory Structure
```
src/app/
├── core/
│   ├── models/          # TypeScript interfaces and enums
│   │   ├── conversion-format.ts    # ConversionFormat enum + FormatInfo
│   │   └── conversion-result.ts    # Conversion result interfaces
│   └── services/        # Core Angular services
│       ├── converter.service.ts    # Main conversion orchestrator
│       ├── base64.service.ts       # Base64 encode/decode (browser-native)
│       ├── csv.service.ts          # CSV parsing with auto-detection
│       ├── epub.service.ts         # EPUB3 generation (metadata, TOC, cover)
│       ├── file-system.service.ts  # File I/O multiplatform
│       ├── html.service.ts         # HTML sanitization and processing
│       ├── image.service.ts        # Image processing and conversion
│       ├── pdf.service.ts          # PDF creation and extraction
│       ├── pwa-update.service.ts   # PWA update notifications
│       ├── rtf.service.ts          # RTF conversion (browser-native)
│       ├── xml.service.ts          # XML ↔ JSON conversion
│       └── yaml.service.ts         # YAML ↔ JSON conversion
├── features/
│   └── converter/       # Document conversion feature (home page)
└── shared/
    └── components/      # Reusable UI components
        ├── file-picker/         # Drag & drop file picker
        ├── format-selector/     # Format selection modal
        ├── progress-indicator/  # Conversion progress overlay
        └── update-notification/ # PWA update banner
```

## Key Libraries and Usage

### Document Conversion
- **xlsx** (0.18.5) - Excel/CSV/ODS read/write
- **papaparse** (5.5.3) - Advanced CSV parsing with encoding detection
- **marked** (16.4.1) - Markdown → HTML
- **turndown** (7.2.1) - HTML → Markdown
- **jszip** (3.10.1) - ZIP handling for EPUB
- **yaml** (2.6.1) - YAML parsing and serialization (by eemeli)
- **fast-xml-parser** (4.5.2) - Fast XML ↔ JSON conversion
- **dompurify** (3.2.6) - HTML sanitization for security
- **piexifjs** (1.0.7) - EXIF metadata preservation in images

### PDF Processing
- **pdfjs-dist** (5.4.296) - PDF reading, rendering, text extraction (Mozilla)
- **pdf-lib** (1.17.1) - PDF creation/modification
- **jspdf** (3.0.3) - Alternative PDF generation

### Browser-Native Implementations
- **RTF Service** - Custom HTML ↔ RTF converter (0 dependencies)
- **Base64 Service** - Native encode/decode (0 dependencies)

### Capacitor Plugins
- **@capacitor/filesystem** (7.1.4) - File system operations
- **@capacitor/share** (7.0.2) - Native share dialog
- **@capacitor/network** (7.0.2) - Network status detection

## Performance Considerations

### Bundle Size Strategy
```
Initial Bundle:  665 KB raw / 174 KB gzipped
Lazy Chunks:     1008 KB total (lazy-loaded on demand)

Breakdown:
├── xlsx:              423 KB (119 KB gzipped)
├── marked:             40 KB (11 KB gzipped)
├── turndown:           11 KB (4 KB gzipped)
├── yaml:              104 KB (29 KB gzipped)
├── pdfjs-dist:        400 KB (98 KB gzipped)
└── fast-xml-parser:    30 KB (9 KB gzipped)
```

**Always use dynamic imports for heavy libraries**:
```typescript
// Good - lazy load heavy libraries (converter.service.ts pattern)
private async getXLSX() {
  if (!this.xlsxCache) {
    const module = await import('xlsx');
    this.xlsxCache = module;
  }
  return this.xlsxCache;
}

// Good - usage
const XLSX = await this.getXLSX();
const workbook = XLSX.read(data);

// Bad - loads in main bundle
import * as XLSX from 'xlsx';
```

**Current lazy-loaded libraries in ConverterService**:
- `xlsx` - Loaded for XLSX/ODS/CSV conversions
- `marked` - Loaded for Markdown → HTML
- `turndown` - Loaded for HTML → Markdown
- `yaml` - Loaded for YAML conversions
- `fast-xml-parser` - Loaded for XML conversions
- `pdfjs-dist` - Loaded for PDF reading

### Memory Management
- Large images should be resized before processing
- PDF multi-page rendering is memory intensive - process page by page
- Clear canvas contexts after use to free memory
- **Always revoke Object URLs** after use to prevent memory leaks:
  ```typescript
  const url = URL.createObjectURL(blob);
  // Use url...
  URL.revokeObjectURL(url); // CRITICAL: prevents memory leak
  ```
- Use `FileReader` efficiently - avoid creating multiple instances unnecessarily

## Configuration Files

### angular.json
- Output directory: `www/` (required by Capacitor)
- Bundle budgets: Initial 5MB max, component styles 4KB max
- Environment file replacement configured for production

### capacitor.config.ts
- `appId`: `io.ionic.starter` (should be changed for production)
- `webDir`: `www` (matches Angular build output)

### tsconfig.json
- Target: ES2022 with DOM libs
- `moduleResolution: "bundler"` (Angular 20 default)
- Strict mode enabled
- Path aliases configured
- `skipLibCheck: true` - Required for pdfjs-dist type compatibility
- Separate configs: `tsconfig.app.json`, `tsconfig.spec.json`, `cypress/tsconfig.json`

## Environment Configuration

Configuration lives in `src/environments/`:
- `environment.ts` - Development config
- `environment.prod.ts` - Production config (file replacement in angular.json)

Available settings:
- `conversion.maxFileSize` - Max file size (50MB)
- `conversion.defaultQuality` - Image quality (85)
- `conversion.defaultDPI` - PDF rendering DPI (150)

## Format Support Matrix

Conversion capabilities are defined in `src/app/core/models/conversion-format.ts`. Key points:

### Fully Supported Formats (15+)
- **Text formats**: TXT, Markdown (MD), HTML, RTF
- **Data formats**: CSV, JSON, XLSX, ODS, YAML, XML, Base64
- **Document formats**: PDF (creation + extraction), EPUB
- **Image formats**: PNG, JPEG, WEBP

### Format-Specific Notes
- **RTF**: Browser-native implementation, HTML ↔ RTF only (no direct text extraction)
- **ODS**: Read/write supported (limited to SheetJS OSS features)
- **PDF**: Creation from all formats, text extraction only (no formatting preservation)
- **EPUB**: Full EPUB3 generation with metadata, TOC, and cover support
- **Base64**: Encode/decode for all supported formats
- **Multi-step conversions**: Automatic chaining (e.g., XML → JSON → YAML)

### Not Supported
- **DOCX, DOC, ODT**: Require backend or commercial libraries (Office Open XML complexity)

## Progressive Web App Strategy

### Offline-First Design
All conversions run client-side with no backend required. Service Worker caches:
1. Core app shell and assets (indefinite cache)
2. PDF libraries: pdfjs-dist (~2MB, 14 days cache)

Configuration: `ngsw-config.json`

### PWA Features
- **PwaUpdateService** (`src/app/core/services/pwa-update.service.ts`) - Automatic update checks every 6 hours
- **UpdateNotificationComponent** - User notification for new app versions
- **Service Worker** - Only active in production builds (`registerWhenStable:30000`)
- **Manifest** - `public/manifest.webmanifest` for installability

### Testing PWA Locally
```bash
npm run build -- --configuration production
npx http-server www -p 8080
# Open http://localhost:8080 and test offline mode
```

### Capacitor Platform Detection
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Native mobile - use Capacitor plugins
} else {
  // Web - use browser APIs as fallback
}
```

## Code Style Notes

- Use Angular 20 features: signals, inject(), standalone components where applicable (though current codebase is NgModule-based)
- Ionic components for UI consistency
- TypeScript strict mode is enabled - all code must be type-safe
- Use path aliases (`@core/*`, `@shared/*`) consistently

### Memory Leak Prevention (Critical)
**Always implement proper cleanup to prevent memory leaks:**

1. **Observable Subscriptions** - Must be unsubscribed in `ngOnDestroy`:
```typescript
export class MyComponent implements OnDestroy {
  private subscriptions = new Subscription();

  ngOnInit() {
    const sub = this.service.data$.subscribe(...);
    this.subscriptions.add(sub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
```

2. **Timers (setTimeout/setInterval)** - Must be cleared:
```typescript
export class MyComponent implements OnDestroy {
  private timeoutId?: number;

  doSomething() {
    this.timeoutId = window.setTimeout(() => {...}, 3000);
  }

  ngOnDestroy() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
  }
}
```

3. **Nested Subscriptions** - Parent subscription must track children:
```typescript
this.parentSub = observable1$.subscribe(() => {
  const childSub = observable2$.subscribe(...);
  this.parentSub.add(childSub); // Track nested subscription
});
```

4. **Services with Subscriptions** - Services must implement `OnDestroy` if they create subscriptions or timers that need cleanup

5. **Object URL Cleanup** - Always revoke URLs created with `URL.createObjectURL()`:
```typescript
export class ImageService {
  async convertImage(file: File): Promise<Blob> {
    const url = URL.createObjectURL(file);

    // Add timeout cleanup as safety net
    const timeoutId = window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30000); // 30 second fallback

    try {
      const result = await this.processImage(url);
      return result;
    } finally {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url); // Clean up immediately
    }
  }
}
```

6. **FileReader Optimization** - Avoid creating duplicate FileReader instances:
```typescript
// Bad - creates multiple FileReader instances
async function readFile(file: File) {
  const reader1 = new FileReader();
  const encoding = await detectEncoding(file); // Creates another FileReader internally
  const reader2 = new FileReader(); // Duplicate!
  // ...
}

// Good - reuse or coordinate FileReader usage
async function readFile(file: File) {
  const encoding = await detectEncoding(file); // Uses FileReader
  const text = await file.text(); // Use File API instead of creating another FileReader
  // ...
}
```

## Conversion Services Architecture

### Service Responsibilities

Each conversion service handles specific format conversions:

#### Base64Service (`base64.service.ts`)
- **Purpose**: Encode/decode any file to/from Base64
- **Dependencies**: None (browser-native)
- **Key methods**: `encodeFile()`, `decodeBase64()`
- **Notes**: Uses `FileReader.readAsDataURL()` and `atob()`/`btoa()`

#### CsvService (`csv.service.ts`)
- **Purpose**: Advanced CSV parsing and generation
- **Dependencies**: `papaparse`
- **Key features**:
  - Automatic encoding detection (UTF-8, UTF-16, ISO-8859-1)
  - Delimiter auto-detection
  - Header row detection
- **Key methods**: `parseCSV()`, `generateCSV()`

#### EpubService (`epub.service.ts`)
- **Purpose**: Generate EPUB3 files from HTML/Markdown
- **Dependencies**: `jszip`, `marked`
- **Key features**:
  - Full EPUB3 spec compliance
  - Table of contents generation
  - Metadata support (title, author, language)
  - Cover image support
- **Key methods**: `createEpub()`

#### HtmlService (`html.service.ts`)
- **Purpose**: HTML processing and sanitization
- **Dependencies**: `dompurify`, `juice` (for inline CSS)
- **Key features**:
  - XSS protection via DOMPurify
  - CSS inlining for email-safe HTML
  - HTML minification (browser-compatible)
  - HTML validation (security risks detection)
  - Text extraction (strip HTML tags)
  - HTML utilities (escape/unescape, wrap, beautify)
- **Key methods**:
  - `sanitize()` - Sanitize HTML with configurable options
  - `inlineCss()` - Convert external/internal CSS to inline styles
  - `minifyHtml()` - Minify HTML (remove whitespace, comments)
  - `processForEmail()` - Complete pipeline: sanitize → inline CSS → minify
  - `validateHtml()` - Detect security risks and common issues
  - `extractText()` - Extract plain text from HTML
  - `wrapInHtml()` - Wrap text in HTML document structure
  - `escapeHtml()` / `unescapeHtml()` - Escape/unescape HTML entities
  - `beautifyHtml()` - Format HTML with indentation

#### PdfService (`pdf.service.ts`)
- **Purpose**: PDF creation and advanced text extraction
- **Dependencies**: `pdf-lib` (creation), `pdfjs-dist` (extraction, lazy-loaded)
- **Key features**:
  - Create PDF from text with custom formatting
  - Create PDF from images (single or multiple)
  - **Enhanced text extraction with formatting preservation**
  - PDF page rendering to canvas/images
  - PDF metadata extraction
- **Key methods**:
  - `createPdfFromText()` - Generate PDF from text string
  - `createPdfFromImage()` - Generate PDF from image file
  - `extractTextFromPdf(file, preserveFormatting?)` - Extract text with optional formatting
    - `preserveFormatting: false` - Simple concatenation (faster)
    - `preserveFormatting: true` - Preserves paragraphs, indentation, lists (default)
  - `convertPdfPageToImage()` - Render PDF page to image
- **Advanced Text Extraction**:
  - Smart line/paragraph detection using Y-coordinates analysis
  - Automatic gap detection for proper word/line spacing
  - Configurable line height threshold for paragraph breaks
  - Preserves document structure (headings, lists, indentation)
- **Note**: Text extraction uses Mozilla PDF.js (lazy-loaded ~400 KB)

#### RtfService (`rtf.service.ts`)
- **Purpose**: HTML ↔ RTF conversion
- **Dependencies**: None (custom browser-native implementation)
- **Key features**:
  - Supports: bold, italic, underline, headings (h1-h6), lists, links, paragraphs
  - Uses DOMParser for HTML parsing
  - Pure TypeScript implementation
- **Key methods**: `htmlToRtf()`, `rtfToHtml()`
- **Note**: Custom implementation created to avoid Node.js dependencies (replaced html-to-rtf, saved 80 npm packages)

#### XmlService (`xml.service.ts`)
- **Purpose**: XML ↔ JSON bidirectional conversion
- **Dependencies**: `fast-xml-parser`
- **Key features**:
  - Preserves attributes and text nodes
  - Configurable parsing options
- **Key methods**: `xmlToJson()`, `jsonToXml()`

#### YamlService (`yaml.service.ts`)
- **Purpose**: YAML ↔ JSON bidirectional conversion
- **Dependencies**: `yaml` (by eemeli)
- **Key features**:
  - Full YAML 1.2 spec support
  - Type preservation (dates, numbers, booleans)
  - Comments preservation in round-trip
- **Key methods**: `yamlToJson()`, `jsonToYaml()`

### Converter Service Pattern

The `ConverterService` (`converter.service.ts`) orchestrates all conversions:

```typescript
export class ConverterService {
  // Lazy-loaded library caches
  private xlsxCache?: typeof import('xlsx');
  private markedCache?: typeof import('marked');

  // Helper methods for lazy loading
  private async getXLSX() {
    if (!this.xlsxCache) {
      this.xlsxCache = await import('xlsx');
    }
    return this.xlsxCache;
  }

  // Main conversion method
  async convert(file: File, targetFormat: ConversionFormat): Promise<ConversionResult> {
    const sourceFormat = this.detectFormat(file);

    // Direct conversion if supported
    if (this.canConvertDirect(sourceFormat, targetFormat)) {
      return this.convertDirect(file, sourceFormat, targetFormat);
    }

    // Multi-step conversion chain
    return this.convertMultiStep(file, sourceFormat, targetFormat);
  }
}
```

### Adding New Format Support

To add a new format:

1. **Update ConversionFormat enum** (`conversion-format.ts`):
   ```typescript
   export enum ConversionFormat {
     // ...existing formats
     NEW_FORMAT = 'NEW_FORMAT'
   }
   ```

2. **Create service** (if complex logic needed):
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class NewFormatService {
     async convertFrom(data: string): Promise<string> { /* ... */ }
     async convertTo(data: string): Promise<string> { /* ... */ }
   }
   ```

3. **Update ConverterService**:
   - Add conversion logic in `convertDirect()`
   - Update `canConvertDirect()` matrix
   - Add to `detectFormat()` if needed

4. **Add tests**:
   - Unit tests in `new-format.service.spec.ts`
   - E2E tests in `cypress/e2e/new-format.cy.ts`

## Testing

### Unit Tests (Jasmine + Karma)
- Test files: `*.spec.ts` alongside source files
- Run all tests: `npm test`
- Run in CI mode: `npm test -- --no-watch --browsers=ChromeHeadless`
- Run specific test: `ng test --include='**/conversion-format.spec.ts'`
- Coverage report: `npm test -- --no-watch --code-coverage`

### E2E Tests (Cypress)
- Test files: `cypress/e2e/*.cy.ts`
- Interactive mode: `npm run e2e` (requires dev server running)
- Headless mode: `npm run e2e:ci`
- Viewport: 375x667 (iPhone SE, mobile-first)
- Configuration: `cypress.config.ts`, `cypress/tsconfig.json`

### Test Coverage
Current test suite includes:
- Service test files with unit tests
- E2E test files for conversion scenarios
- Coverage areas: file conversion, PDF, images, file system

## Development Tools

### Git Hooks (Husky)
Pre-commit hooks are configured to run automatically:
- `lint-staged` runs ESLint + Prettier on staged files
- Commits are blocked if linting fails
- Skip hooks only in emergencies: `git commit --no-verify`

### Code Formatting
- Prettier enforces consistent code style
- Single quotes, semicolons, 100 char line width
- Auto-format on commit via lint-staged
- Manual format: `npm run format`

### Bundle Analysis
- Use `npm run analyze` to visualize bundle composition
- Identify large dependencies and optimization opportunities
- Monitor lazy-loaded chunks vs main bundle

## Common Issues and Workarounds

### TypeScript Compilation
If you encounter TypeScript errors with third-party libraries:
1. Check if `skipLibCheck: true` is set in `tsconfig.json`
2. For Cypress, ensure `cypress/tsconfig.json` extends the base config

### Build Warnings
Expected warnings (non-blocking):
- CommonJS dependency warnings for `pdf-lib` (unavoidable, library not ESM)
- SCSS budget warnings for large component styles (monitor but acceptable)
- Bundle size warnings if under 5MB initial (configured in `angular.json`)

### Service Worker Issues
If Service Worker isn't working:
- Service Worker only works in production builds
- Use `npm run build -- --configuration production`
- Serve from `www/` directory, not dev server
- Check browser DevTools > Application > Service Workers

### Git Pre-commit Hooks Slow
If pre-commit hooks are too slow:
- `lint-staged` only processes staged files (already optimized)
- Temporary bypass: `git commit --no-verify` (use sparingly)
- Consider increasing Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
