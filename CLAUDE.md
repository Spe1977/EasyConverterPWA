# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyConverter is a mobile-first Progressive Web App built with Angular 20, Ionic 8, and Capacitor 7 for offline document conversion and scanning. All conversions run 100% client-side in the browser using TypeScript libraries.

**Core functionality**: Convert between 10+ formats (TXT, MD, HTML, CSV, JSON, XLSX, ODS, PDF, PNG/JPEG/WEBP, EPUB) and scan documents using camera with OCR capabilities.

## Development Commands

### Essential Commands
- `npm start` - Start dev server (default port via Ionic)
- `npm run build` - Production build (outputs to `www/`)
- `npm run watch` - Build in watch mode for development
- `npm test` - Run unit tests with Karma
- `npm run lint` - Lint TypeScript and HTML files with ESLint

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
│   │   ├── conversion-result.ts    # Conversion result interfaces
│   │   └── scan-options.ts         # Scanner and OCR interfaces
│   └── services/        # Core Angular services (to be implemented)
├── features/
│   ├── converter/       # Document conversion feature module
│   └── scanner/         # Camera scanning feature module
├── shared/
│   └── components/      # Reusable UI components
└── workers/             # Web Workers for heavy processing (OCR, image processing)
```

## Key Libraries and Usage

### Document Conversion
- **xlsx** (0.18.5) - Excel/CSV/ODS read/write
- **papaparse** (5.5.3) - Advanced CSV parsing
- **marked** (16.4.1) - Markdown → HTML
- **turndown** (7.2.1) - HTML → Markdown
- **jszip** (3.10.1) - ZIP handling for EPUB

### PDF Processing
- **pdfjs-dist** (5.4.296) - PDF reading, rendering, text extraction (Mozilla)
- **pdf-lib** (1.17.1) - PDF creation/modification
- **jspdf** (3.0.3) - Alternative PDF generation

### Image & OCR (Lazy-Loaded)
- **opencv.js** (1.2.1) - ~10MB, edge detection, perspective correction, auto-crop
- **tesseract.js** (6.0.1) - ~2MB + 2-4MB language data, OCR text recognition

### Capacitor Plugins
- **@capacitor/camera** (7.0.2) - Camera access with web fallback
- **@capacitor/filesystem** (7.1.4) - File system operations
- **@capacitor/share** (7.0.2) - Native share dialog
- **@capacitor/network** (7.0.2) - Network status detection

## Performance Considerations

### Bundle Size Strategy
- Core bundle: ~600KB (always loaded)
- PDF libraries: ~2MB (lazy loaded on demand)
- opencv.js: ~10MB (lazy loaded with dynamic import)
- tesseract.js: ~2MB + language data (lazy loaded)

**Always use dynamic imports for heavy libraries**:
```typescript
// Good - lazy load opencv.js
const cv = await import('opencv.js');

// Bad - loads opencv.js in main bundle
import * as cv from 'opencv.js';
```

### Web Workers
Heavy processing (OCR, image processing) **must run in Web Workers** to avoid blocking the UI thread. Workers are located in `src/workers/`.

### Memory Management
- Images from camera can be 8-12MP - resize before processing
- PDF multi-page rendering is memory intensive - process page by page
- Clear canvas contexts and dispose of opencv Mat objects after use

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

## Environment Configuration

Configuration lives in `src/environments/`:
- `environment.ts` - Development config
- `environment.prod.ts` - Production config (file replacement in angular.json)

Available settings:
- `ocr.defaultLanguage` - Default OCR language ('ita')
- `ocr.supportedLanguages` - Available OCR languages array
- `conversion.maxFileSize` - Max file size (50MB)
- `conversion.defaultQuality` - Image quality (85)
- `conversion.defaultDPI` - PDF rendering DPI (150)

## Format Support Matrix

Conversion capabilities are defined in `src/app/core/models/conversion-format.ts`. Key points:

- **Full support**: TXT, MD, HTML, CSV, JSON, XLSX, PDF, PNG/JPEG/WEBP conversions
- **Limited support**: ODS (read works, write requires SheetJS Pro)
- **PDF to text**: Extraction only, no formatting preservation
- **OCR**: 70-95% accuracy depending on image quality
- **No support**: DOCX, DOC, ODT, RTF (require backend or commercial libraries)

## Progressive Web App Strategy

### Offline-First Design
All conversions run client-side with no backend required. Service Worker should cache:
1. Core app shell and assets
2. Heavy libraries (opencv.js, tesseract.js, language data)
3. Previously converted files (optional, with size limits)

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

## Testing

- Unit tests use Jasmine + Karma
- Test files: `*.spec.ts` alongside source files
- Run specific test: `ng test --include='**/conversion-format.spec.ts'`
- CI mode: `npm test -- --no-watch --no-progress --browsers=ChromeHeadless`
