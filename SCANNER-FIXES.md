# Scanner Issues Fixed

## Issues Identified and Resolved

### 1. Web Worker Configuration Error
**Error**: `Failed to construct 'Worker': Script at 'file://...' cannot be accessed from origin 'http://localhost:4200'`

**Root Cause**: Angular wasn't configured to properly build and serve Web Workers.

**Fix**:
- Added `webWorkerTsConfig: "tsconfig.worker.json"` to `angular.json` build options
- Created `tsconfig.worker.json` with proper Web Worker configuration
- Added error handling and timeout to worker initialization in `scanner.service.ts`

**Files Modified**:
- `angular.json` - Added webWorkerTsConfig option
- `tsconfig.worker.json` - New file for Web Worker TypeScript configuration
- `src/app/core/services/scanner.service.ts` - Enhanced worker initialization with timeout and error handling

### 2. Camera API Initialization Error
**Error**: `TypeError: Cannot read properties of undefined (reading 'takePhoto')`

**Root Cause**: The Capacitor Camera plugin's PWA fallback wasn't handling browser camera API availability correctly.

**Fix**:
- Added check for `navigator.mediaDevices.getUserMedia` before attempting camera access
- Improved error messages for unsupported browsers
- Added graceful handling of user cancellation
- Enhanced error messages with better context

**Files Modified**:
- `src/app/core/services/scanner.service.ts` - Added camera availability checks and better error handling

### 3. Manifest 404 Error
**Error**: `GET http://localhost:4200/manifest.webmanifest 404 (Not Found)`

**Root Cause**:
1. Manifest icon paths were relative to manifest location instead of web root
2. Duplicate manifest link in HTML
3. Missing metadata

**Fix**:
- Updated all icon paths in manifest from `icons/` to `assets/icons/`
- Removed duplicate manifest link from `index.html`
- Added proper PWA metadata (title, description, theme-color)
- Added iOS-specific meta tags for better mobile support

**Files Modified**:
- `src/assets/manifest.webmanifest` - Fixed icon paths
- `src/index.html` - Removed duplicate, improved metadata

## Testing Instructions

### 1. Restart Development Server
The Web Worker configuration requires a fresh build:

```bash
# Stop the current dev server (Ctrl+C)
npm start
```

### 2. Test Web Worker Initialization
1. Open browser DevTools (F12)
2. Go to Scanner page
3. Check Console for errors
4. The worker initialization timeout is set to 30 seconds

### 3. Test Camera Functionality
**In Browser (Desktop)**:
- Click "Scansiona Documento" - should show camera permission prompt or error
- Click "Carica da Galleria" - should open file picker (this is the recommended method for browser)

**Important**: In browser, the camera feature may not work due to PWA limitations. Use "Carica da Galleria" instead.

**On Mobile (via Capacitor)**:
```bash
npx cap sync
npx cap run android
# or
npx cap run ios
```

### 4. Verify Manifest
1. Open http://localhost:4200/manifest.webmanifest
2. Should return JSON (not 404)
3. Check DevTools > Application > Manifest
4. All icons should be accessible

## Known Limitations

### Browser Camera on Desktop
The browser camera feature has limitations:
- Requires HTTPS (except localhost)
- Requires camera permissions
- May not work in all browsers
- **Recommended**: Use "Carica da Galleria" for desktop browsers

### Web Worker with OpenCV.js
- Initial load of OpenCV.js (~10MB) may take time
- 30-second timeout is generous but may need adjustment on slow connections
- Worker runs in background to avoid blocking UI

## Production Build

For production, ensure you build with:
```bash
npm run build -- --configuration production
```

This will:
- Properly bundle Web Workers
- Enable Service Worker (PWA)
- Serve manifest correctly
- Optimize all assets

## Additional Notes

### Error Messages
User-facing error messages have been improved:
- "Camera API not supported in this browser. Please use the gallery option."
- "Image capture cancelled by user"
- "Worker initialization timeout"

### File Structure
```
src/
├── workers/
│   ├── image-processing.worker.ts  # OpenCV.js processing
│   └── ocr.worker.ts                # Tesseract.js OCR
├── assets/
│   ├── icons/                       # PWA icons
│   └── manifest.webmanifest         # PWA manifest
└── app/
    └── core/
        └── services/
            └── scanner.service.ts   # Scanner orchestration
```

### Performance
- OpenCV.js is lazy-loaded on first scanner use (~10MB)
- Tesseract.js is lazy-loaded on first OCR use (~2-6MB)
- All processing runs in Web Workers to keep UI responsive

## Troubleshooting

**Problem**: Worker still fails to load
**Solution**:
1. Clear browser cache
2. Restart dev server
3. Check browser console for specific error
4. Verify `tsconfig.worker.json` exists

**Problem**: Camera button does nothing
**Solution**:
1. Check browser console for errors
2. Use "Carica da Galleria" instead on desktop
3. Verify on actual mobile device with Capacitor

**Problem**: Manifest still 404
**Solution**:
1. Restart dev server
2. Check `angular.json` has manifest asset configuration
3. Verify file exists at `src/assets/manifest.webmanifest`
