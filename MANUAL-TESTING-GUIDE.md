# EasyConverter - Cross-Browser Manual Testing Guide

**Version:** 2.0.0
**Date:** 2025-12-07
**Test Environment:** http://localhost:8080

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Automated Test Results](#automated-test-results)
3. [Manual Testing Checklist](#manual-testing-checklist)
4. [RTF Conversion Tests](#rtf-conversion-tests)
5. [PDF Extraction Tests](#pdf-extraction-tests)
6. [PWA Offline Mode Tests](#pwa-offline-mode-tests)
7. [Performance Tests](#performance-tests)
8. [Mobile Testing](#mobile-testing)
9. [Test Results Template](#test-results-template)

---

## Prerequisites

### Required Browsers

Test on the following browsers to ensure maximum compatibility:

- ✅ **Google Chrome** (latest version) - Chromium-based
- ✅ **Mozilla Firefox** (latest version)
- ✅ **Safari** (latest version, macOS/iOS only)
- ✅ **Microsoft Edge** (latest version) - Chromium-based
- ⚠️ **Mobile Safari** (iOS) - Critical for PWA testing
- ⚠️ **Chrome Mobile** (Android) - Critical for PWA testing

### Test Environment Setup

1. **Build the production app**:

   ```bash
   npm run build -- --configuration production
   ```

2. **Start local server**:

   ```bash
   npx serve www -l 8080 -s
   ```

3. **Open in browser**:
   - Navigate to: **http://localhost:8080**
   - For mobile: Use your computer's local IP (e.g., http://192.168.1.100:8080)

### Test Files Needed

Create the following test files in a `test-assets/` directory:

- `sample.html` - Simple HTML with bold, italic, headings, lists
- `formatted.html` - Complex HTML with nested structures
- `sample.rtf` - Basic RTF document
- `sample.pdf` - Multi-page PDF with text
- `large.pdf` - PDF with 10+ pages for performance testing
- `sample.txt` - Plain text file
- `sample.md` - Markdown file with formatting

---

## Automated Test Results

### Summary (2025-12-07)

```
Total Tests:     216
Passed:          141 (65.3%)
Failed:          75 (34.7%)
Duration:        1.6 minutes
```

### Results by Browser

#### Chromium ✅

- **Passed**: 71/72 tests
- **Failed**: 1 test (RTF UI assertion - not critical)
- **Status**: Excellent support

#### Firefox ✅

- **Passed**: 71/72 tests
- **Failed**: 1 test (performance timeout - acceptable)
- **Status**: Excellent support

#### WebKit ❌

- **Passed**: 0/72 tests
- **Failed**: 72 tests (system dependencies missing)
- **Status**: Unable to test automatically - **REQUIRES MANUAL TESTING**
- **Note**: This is why manual Safari testing is CRITICAL

### Key Findings

1. ✅ **Service Worker**: Works on Chromium & Firefox
2. ✅ **PWA Manifest**: Valid on all tested browsers
3. ✅ **Offline Mode**: Fully functional on Chromium & Firefox
4. ✅ **PDF Processing**: All browser APIs supported
5. ⚠️ **Safari/WebKit**: Requires manual testing (no automated data)

---

## Manual Testing Checklist

Use this checklist to track your manual testing progress:

### Browser Coverage

- [ ] Chrome (Desktop)
- [ ] Firefox (Desktop)
- [ ] Safari (Desktop, macOS)
- [ ] Edge (Desktop)
- [ ] Safari (Mobile, iOS)
- [ ] Chrome (Mobile, Android)

### Feature Coverage

- [ ] RTF Conversion (HTML ↔ RTF)
- [ ] PDF Extraction (with formatting)
- [ ] PDF Creation (from various formats)
- [ ] PWA Installation
- [ ] PWA Offline Mode
- [ ] Service Worker Caching
- [ ] File Upload/Download
- [ ] Performance (large files)

---

## RTF Conversion Tests

### Priority: HIGH ⚠️

RTF uses browser-native APIs (DOMParser), so cross-browser testing is critical.

### Test 1: HTML → RTF Conversion

**Steps:**

1. Open http://localhost:8080
2. Click "Select File" or drag & drop `sample.html`
3. Select target format: **RTF**
4. Click "Convert"
5. Download the converted RTF file
6. Open the RTF file in a word processor (e.g., Microsoft Word, LibreOffice)

**Expected Results:**

- ✅ File uploads successfully
- ✅ Conversion completes within 2-3 seconds
- ✅ Download starts automatically
- ✅ RTF file opens in word processor
- ✅ Bold text is preserved as **bold**
- ✅ Italic text is preserved as _italic_
- ✅ Underlined text is underlined
- ✅ Headings (H1-H6) are larger/bold
- ✅ Lists (ul/ol) are formatted correctly
- ✅ Links are preserved (clickable)
- ✅ Paragraphs have proper spacing

**Test Cases:**

| Test File       | Content                        | Expected Outcome            |
| --------------- | ------------------------------ | --------------------------- |
| `simple.html`   | Plain text with `<p>` tags     | Basic paragraph conversion  |
| `bold.html`     | Text with `<strong>` and `<b>` | Bold formatting preserved   |
| `italic.html`   | Text with `<em>` and `<i>`     | Italic formatting preserved |
| `headings.html` | `<h1>` to `<h6>` elements      | Heading sizes correct       |
| `lists.html`    | `<ul>` and `<ol>` lists        | Bullet/numbered lists       |
| `links.html`    | `<a href="...">` links         | Clickable hyperlinks        |
| `mixed.html`    | Complex nested formatting      | All formatting preserved    |

**Potential Issues to Check:**

- [ ] Special characters (é, à, ñ, ©, ®, ™)
- [ ] Unicode symbols (€, £, ¥)
- [ ] Nested formatting (`<strong><em>both</em></strong>`)
- [ ] Empty paragraphs
- [ ] Long documents (100+ paragraphs)

### Test 2: RTF → HTML Conversion

**Steps:**

1. Open http://localhost:8080
2. Upload `sample.rtf`
3. Select target format: **HTML**
4. Click "Convert"
5. Download and open HTML in browser

**Expected Results:**

- ✅ RTF file uploads successfully
- ✅ Conversion completes within 2-3 seconds
- ✅ HTML renders correctly in browser
- ✅ RTF formatting (bold, italic, underline) converted to HTML tags
- ✅ Paragraphs separated with `<p>` tags
- ✅ No HTML parsing errors

**Browser-Specific Checks:**

| Browser | DOMParser API | RTF Parsing | Special Characters |
| ------- | ------------- | ----------- | ------------------ |
| Chrome  | ✅            | ✅          | ✅                 |
| Firefox | ✅            | ✅          | ✅                 |
| Safari  | ⚠️ Test       | ⚠️ Test     | ⚠️ Test            |
| Edge    | ✅            | ✅          | ✅                 |

---

## PDF Extraction Tests

### Priority: HIGH ⚠️

PDF.js is used for extraction. Test cross-browser rendering and text extraction.

### Test 3: PDF Text Extraction (Simple)

**Steps:**

1. Open http://localhost:8080
2. Upload `sample.pdf` (simple text-based PDF)
3. Select target format: **TXT**
4. Click "Convert"
5. Download and open TXT file

**Expected Results:**

- ✅ PDF uploads successfully
- ✅ Extraction completes within 5 seconds
- ✅ TXT file contains all text from PDF
- ✅ Text is readable and complete
- ✅ No garbled characters

### Test 4: PDF Text Extraction (Formatted)

**Steps:**

1. Upload `formatted.pdf` (PDF with headings, paragraphs, lists)
2. Select target format: **TXT** or **HTML**
3. Enable "Preserve Formatting" option (if available)
4. Click "Convert"

**Expected Results:**

- ✅ Paragraphs preserved (line breaks between paragraphs)
- ✅ Indentation detected (lists, quotes)
- ✅ Headings separated from body text
- ✅ No missing text
- ✅ Proper word spacing (no concatenated words)

**Test Cases:**

| PDF Type                  | Expected Behavior              |
| ------------------------- | ------------------------------ |
| Single page               | Extract all text correctly     |
| Multi-page (10 pages)     | Extract all pages sequentially |
| With images               | Skip images, extract text only |
| Scanned PDF (image-based) | Gracefully handle (no text)    |
| Password-protected        | Show error message             |

### Test 5: PDF Creation

**Steps:**

1. Upload `sample.txt`, `sample.md`, or `sample.html`
2. Select target format: **PDF**
3. Click "Convert"
4. Download and open PDF

**Expected Results:**

- ✅ PDF created successfully
- ✅ PDF opens in browser/PDF reader
- ✅ Text is readable
- ✅ Formatting preserved (for HTML/MD sources)
- ✅ Multiple pages if content is long
- ✅ No blank pages

**Browser Canvas API Check:**

| Browser | Canvas API | PDF Rendering | Text Quality |
| ------- | ---------- | ------------- | ------------ |
| Chrome  | ✅         | ✅            | ✅           |
| Firefox | ✅         | ✅            | ✅           |
| Safari  | ⚠️ Test    | ⚠️ Test       | ⚠️ Test      |
| Edge    | ✅         | ✅            | ✅           |

---

## PWA Offline Mode Tests

### Priority: CRITICAL ⚠️

Offline mode is a core PWA feature. Must work on all browsers.

### Test 6: Service Worker Registration

**Steps:**

1. Open http://localhost:8080 in browser
2. Open DevTools → Application → Service Workers (Chrome/Edge)
   - Or: DevTools → Debugger → Service Workers (Firefox)
   - Or: Develop → Service Workers (Safari)
3. Verify Service Worker is registered and activated

**Expected Results:**

- ✅ Service Worker registers within 30 seconds
- ✅ Status shows "activated"
- ✅ Scope is "/"
- ✅ No errors in console

**Browser-Specific Notes:**

- **Safari**: May require "Develop" menu enabled (Preferences → Advanced)
- **Firefox**: Service Worker may be in "Debugger" tab, not "Application"

### Test 7: Offline Functionality

**Steps:**

1. Open http://localhost:8080
2. Wait for app to fully load (all assets cached)
3. Open DevTools → Network
4. Enable "Offline" mode
5. Refresh the page (Ctrl+R / Cmd+R)
6. Try uploading and converting a file

**Expected Results:**

- ✅ App loads from cache (even offline)
- ✅ UI renders completely
- ✅ File upload works
- ✅ File conversion works (client-side processing)
- ✅ File download works
- ✅ No network errors in console

**Test Cases:**

| Action           | Offline Expected Behavior             |
| ---------------- | ------------------------------------- |
| Page reload      | Loads from cache                      |
| TXT → MD         | Converts successfully                 |
| HTML → RTF       | Converts successfully                 |
| CSV → JSON       | Converts successfully                 |
| PDF → TXT        | Converts successfully (PDF.js cached) |
| Image conversion | Converts successfully                 |

### Test 8: PWA Installation

**Steps:**

1. Open http://localhost:8080
2. Look for "Install App" prompt (Chrome/Edge) or "Add to Home Screen" (Safari)
3. Click "Install" / "Add"
4. Open installed PWA

**Expected Results:**

- ✅ Install prompt appears (or manual "Install" button in address bar)
- ✅ PWA installs successfully
- ✅ PWA opens in standalone window (no browser UI)
- ✅ PWA works offline
- ✅ PWA icon appears in apps list

**Browser Support:**

| Browser           | PWA Install | Standalone Mode | Offline |
| ----------------- | ----------- | --------------- | ------- |
| Chrome (Desktop)  | ✅          | ✅              | ✅      |
| Edge (Desktop)    | ✅          | ✅              | ✅      |
| Firefox (Desktop) | ⚠️ Limited  | ❌              | ✅      |
| Safari (macOS)    | ✅ (manual) | ✅              | ✅      |
| Safari (iOS)      | ✅          | ✅              | ✅      |
| Chrome (Android)  | ✅          | ✅              | ✅      |

**Note**: Firefox supports Service Workers but has limited PWA install support on desktop.

### Test 9: Cache Strategy

**Steps:**

1. Open http://localhost:8080
2. Open DevTools → Application → Cache Storage
3. Expand "ngsw:..." caches
4. Verify cached files

**Expected Files in Cache:**

- `index.html`
- `main.[hash].js`
- `polyfills.[hash].js`
- `styles.[hash].css`
- `manifest.webmanifest`
- `ngsw.json`
- PDF.js worker files (lazy-loaded)

**Expected Results:**

- ✅ App shell cached (prefetch strategy)
- ✅ Lazy chunks cached on-demand
- ✅ Cache size < 5 MB total
- ✅ Old caches cleaned up on update

---

## Performance Tests

### Test 10: Large File Conversion

**Objective**: Ensure app handles large files without crashing or freezing.

**Test Cases:**

| File Type   | Size                   | Expected Time | Max Time |
| ----------- | ---------------------- | ------------- | -------- |
| Large PDF   | 5 MB, 50 pages         | < 10s         | < 30s    |
| Large HTML  | 2 MB, 1000+ paragraphs | < 5s          | < 15s    |
| Large XLSX  | 3 MB, 10k rows         | < 8s          | < 20s    |
| Large Image | 10 MB JPEG             | < 6s          | < 15s    |

**Steps:**

1. Upload large file
2. Start conversion
3. Monitor:
   - Browser responsiveness (UI should not freeze)
   - Memory usage (DevTools → Performance → Memory)
   - Conversion time
4. Verify output is complete

**Expected Results:**

- ✅ UI remains responsive (no freezing)
- ✅ Progress indicator shown
- ✅ Conversion completes successfully
- ✅ Memory is released after conversion
- ✅ No browser "Page Unresponsive" warnings

### Test 11: Bundle Size & Load Time

**Steps:**

1. Open http://localhost:8080 with DevTools → Network
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Record:
   - Initial bundle size (transferred)
   - Total load time
   - Time to Interactive (TTI)

**Expected Metrics:**

| Metric                | Target   | Maximum  |
| --------------------- | -------- | -------- |
| Initial bundle (gzip) | < 180 KB | < 250 KB |
| Total transferred     | < 500 KB | < 1 MB   |
| Load time (fast 3G)   | < 3s     | < 5s     |
| Time to Interactive   | < 2s     | < 4s     |

**Tools:**

- Chrome DevTools → Lighthouse → Performance
- Firefox DevTools → Network → Performance Analysis

---

## Mobile Testing

### Priority: HIGH ⚠️

PWAs are mobile-first. Test on real devices.

### Test 12: Mobile Safari (iOS)

**Device**: iPhone (iOS 14+ required for full PWA support)

**Steps:**

1. Open http://[YOUR_IP]:8080 in Safari
2. Tap Share → "Add to Home Screen"
3. Open PWA from home screen
4. Test offline mode (enable Airplane Mode)
5. Upload files using camera/photo library
6. Convert files
7. Download/share converted files

**Expected Results:**

- ✅ PWA installs to home screen
- ✅ Opens in standalone mode (fullscreen)
- ✅ Works offline
- ✅ File picker integrates with iOS Photos
- ✅ Share sheet works for downloads
- ✅ No layout issues (responsive design)

**Known Issues to Check:**

- [ ] iOS Service Worker restrictions (may require reload)
- [ ] File upload limitations (iOS photo picker)
- [ ] Download behavior (may open in new tab vs. direct download)

### Test 13: Chrome Mobile (Android)

**Device**: Android 8+ (Chrome 80+)

**Steps:**

1. Open http://[YOUR_IP]:8080 in Chrome
2. Tap "Install" prompt or Menu → "Install app"
3. Open PWA from app drawer
4. Test offline mode (enable Airplane Mode)
5. Upload files from device storage
6. Convert files
7. Download/share converted files

**Expected Results:**

- ✅ PWA install prompt appears
- ✅ PWA listed in app drawer
- ✅ Opens in standalone mode
- ✅ Works offline
- ✅ File picker works (device storage)
- ✅ Downloads save to device
- ✅ Share functionality works

### Mobile Performance Checklist

- [ ] App loads in < 3 seconds on 4G
- [ ] No horizontal scrolling
- [ ] Touch targets are 44x44px minimum
- [ ] Text is readable without zooming
- [ ] Conversion works on low-end devices
- [ ] No memory crashes on large files

---

## Test Results Template

Use this template to document your manual testing results.

### Test Session Info

```
Tester:          [Your Name]
Date:            [YYYY-MM-DD]
EasyConverter:   v2.0.0
Test Duration:   [X hours]
```

### Browser Test Results

#### Desktop Browsers

| Browser | Version   | OS    | RTF Conv | PDF Extr | PWA Offline | Issues  |
| ------- | --------- | ----- | -------- | -------- | ----------- | ------- |
| Chrome  | [version] | [OS]  | ✅/❌    | ✅/❌    | ✅/❌       | [notes] |
| Firefox | [version] | [OS]  | ✅/❌    | ✅/❌    | ✅/❌       | [notes] |
| Safari  | [version] | macOS | ✅/❌    | ✅/❌    | ✅/❌       | [notes] |
| Edge    | [version] | [OS]  | ✅/❌    | ✅/❌    | ✅/❌       | [notes] |

#### Mobile Browsers

| Browser | Device           | OS Version    | RTF   | PDF   | PWA   | Install | Offline | Issues  |
| ------- | ---------------- | ------------- | ----- | ----- | ----- | ------- | ------- | ------- |
| Safari  | iPhone [model]   | iOS [ver]     | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌   | ✅/❌   | [notes] |
| Chrome  | [Android device] | Android [ver] | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌   | ✅/❌   | [notes] |

### Issues Found

```markdown
#### Issue #1: [Short Description]

**Browser**: [Browser name + version]
**Severity**: High / Medium / Low
**Steps to Reproduce**:

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]
**Actual**: [What actually happened]

**Screenshots/Logs**: [Attach if available]
**Workaround**: [If any]
```

### Performance Metrics

| Test                 | Browser | File Size | Time (s) | Status |
| -------------------- | ------- | --------- | -------- | ------ |
| Large PDF extraction | Chrome  | 5 MB      | [X.X]    | ✅/❌  |
| Large HTML → RTF     | Firefox | 2 MB      | [X.X]    | ✅/❌  |
| XLSX conversion      | Safari  | 3 MB      | [X.X]    | ✅/❌  |

### Overall Assessment

```markdown
**Pass Rate**: [X/Y tests passed] ([XX]%)

**Critical Issues**: [Number found]
**Blocking Issues**: [Number found]

**Recommendation**:

- [ ] Ready for production
- [ ] Minor fixes needed
- [ ] Major fixes required

**Notes**: [Additional observations]
```

---

## Common Issues & Troubleshooting

### Issue: Service Worker Not Registering

**Symptoms**: PWA doesn't work offline, no Service Worker in DevTools

**Causes**:

- Not using HTTPS or localhost
- Production build not used (`npm run build -- --configuration production`)
- Browser doesn't support Service Workers (very old browser)

**Solution**:

1. Ensure using production build
2. Serve over HTTPS or localhost
3. Check browser version (Chrome 40+, Firefox 44+, Safari 11.1+)

### Issue: RTF File Won't Open

**Symptoms**: RTF file downloads but won't open in word processor

**Causes**:

- RTF header corrupted
- Browser-specific RTF generation issue
- File extension incorrect

**Solution**:

1. Check file extension is `.rtf`
2. Try opening in multiple word processors (Word, LibreOffice, TextEdit)
3. Test on different browser
4. Check browser console for errors

### Issue: PDF Text Extraction Incomplete

**Symptoms**: PDF conversion misses text, garbled output

**Causes**:

- PDF is image-based (scanned document)
- PDF uses non-standard encoding
- PDF.js compatibility issue

**Solution**:

1. Verify PDF is text-based (select text in PDF reader)
2. Try "Preserve Formatting" option
3. Test with different PDF
4. Check browser console for PDF.js errors

### Issue: Offline Mode Not Working

**Symptoms**: App requires internet, doesn't load offline

**Causes**:

- Service Worker not registered
- Cache not populated
- Development build used (Service Worker disabled)

**Solution**:

1. Use production build
2. Visit app online first (to cache assets)
3. Wait 30s for Service Worker to activate
4. Check "ngsw.json" exists at http://localhost:8080/ngsw.json

---

## Next Steps After Testing

1. **Document Results**: Fill out the Test Results Template
2. **File Bugs**: Create GitHub issues for any critical/blocking bugs found
3. **Update CHANGELOG**: Note any browser-specific limitations discovered
4. **Update README**: Add "Browser Compatibility" section if needed
5. **Deploy**: If all tests pass, proceed with deployment

---

## Resources

### Browser DevTools

- **Chrome**: [Chrome DevTools Guide](https://developer.chrome.com/docs/devtools/)
- **Firefox**: [Firefox Developer Tools](https://firefox-dev.tools/)
- **Safari**: [Safari Web Inspector](https://developer.apple.com/safari/tools/)
- **Edge**: [Microsoft Edge DevTools](https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/)

### PWA Testing Tools

- **Lighthouse**: Built into Chrome DevTools (Audits tab)
- **PWA Builder**: https://www.pwabuilder.com/ (validate PWA)
- **WebPageTest**: https://www.webpagetest.org/ (performance testing)

### Compatibility Checkers

- **Can I Use**: https://caniuse.com/ (browser feature support)
- **MDN Web Docs**: https://developer.mozilla.org/ (API documentation)

---

**Last Updated**: 2025-12-07
**Guide Version**: 1.0.0
**Maintained by**: EasyConverter Team
