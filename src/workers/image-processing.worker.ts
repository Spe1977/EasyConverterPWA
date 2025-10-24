/// <reference lib="webworker" />

/**
 * Image Processing Web Worker
 * Esegue elaborazione immagini pesanti (edge detection, perspective correction,
 * auto-crop) utilizzando OpenCV.js in background.
 */

interface ImageProcessingMessage {
  type: 'init' | 'detectEdges' | 'correctPerspective' | 'autoCrop' | 'enhance';
  payload?: {
    imageData?: ImageData;
    points?: { x: number; y: number }[];
    options?: {
      cannyThreshold1?: number;
      cannyThreshold2?: number;
      dilationIterations?: number;
      blurSize?: number;
    };
  };
}

interface ImageProcessingResponse {
  type: 'ready' | 'result' | 'error';
  payload?: {
    imageData?: ImageData;
    edges?: { x: number; y: number }[];
    error?: string;
  };
}

let cv: any = null;
let isInitialized = false;

/**
 * Inizializza OpenCV.js (caricamento asincrono ~10MB)
 */
async function initializeOpenCV(): Promise<void> {
  try {
    // Lazy load opencv.js
    const opencv = await import('opencv.js');
    cv = opencv.default || opencv;

    // Wait for OpenCV to be ready
    if (cv.onRuntimeInitialized) {
      await new Promise<void>((resolve) => {
        cv.onRuntimeInitialized = () => {
          isInitialized = true;
          resolve();
        };
      });
    } else {
      isInitialized = true;
    }

    self.postMessage({ type: 'ready' } as ImageProcessingResponse);
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { error: `Failed to initialize OpenCV: ${error}` },
    } as ImageProcessingResponse);
  }
}

/**
 * Rileva i bordi di un documento nell'immagine
 * Restituisce i 4 punti del contorno del documento
 */
function detectDocumentEdges(
  imageData: ImageData,
  options: { cannyThreshold1?: number; cannyThreshold2?: number } = {}
): { x: number; y: number }[] | null {
  if (!isInitialized || !cv) {
    throw new Error('OpenCV not initialized');
  }

  const { cannyThreshold1 = 50, cannyThreshold2 = 150 } = options;

  // Convert ImageData to cv.Mat
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const hierarchy = new cv.Mat();
  const contours = new cv.MatVector();

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Edge detection
    cv.Canny(blurred, edges, cannyThreshold1, cannyThreshold2);

    // Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find largest contour (should be the document)
    let maxArea = 0;
    let maxContourIndex = -1;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > maxArea) {
        maxArea = area;
        maxContourIndex = i;
      }
    }

    if (maxContourIndex === -1) {
      return null;
    }

    // Approximate contour to polygon
    const contour = contours.get(maxContourIndex);
    const approx = new cv.Mat();
    const peri = cv.arcLength(contour, true);
    cv.approxPolyDP(contour, approx, 0.02 * peri, true);

    // We want 4 points (quadrilateral)
    if (approx.rows !== 4) {
      approx.delete();
      return null;
    }

    // Extract the 4 corner points
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++) {
      points.push({
        x: approx.data32S[i * 2],
        y: approx.data32S[i * 2 + 1],
      });
    }

    approx.delete();
    return points;
  } finally {
    // Cleanup
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    hierarchy.delete();
    contours.delete();
  }
}

/**
 * Corregge la prospettiva di un documento dato 4 punti
 */
function correctPerspective(
  imageData: ImageData,
  points: { x: number; y: number }[]
): ImageData | null {
  if (!isInitialized || !cv || points.length !== 4) {
    throw new Error('OpenCV not initialized or invalid points');
  }

  const src = cv.matFromImageData(imageData);
  const dst = new cv.Mat();

  try {
    // Order points: top-left, top-right, bottom-right, bottom-left
    const orderedPoints = orderPoints(points);

    // Calculate destination width and height
    const widthA = Math.hypot(
      orderedPoints[2].x - orderedPoints[3].x,
      orderedPoints[2].y - orderedPoints[3].y
    );
    const widthB = Math.hypot(
      orderedPoints[1].x - orderedPoints[0].x,
      orderedPoints[1].y - orderedPoints[0].y
    );
    const maxWidth = Math.max(widthA, widthB);

    const heightA = Math.hypot(
      orderedPoints[1].x - orderedPoints[2].x,
      orderedPoints[1].y - orderedPoints[2].y
    );
    const heightB = Math.hypot(
      orderedPoints[0].x - orderedPoints[3].x,
      orderedPoints[0].y - orderedPoints[3].y
    );
    const maxHeight = Math.max(heightA, heightB);

    // Create source and destination point matrices
    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      orderedPoints[0].x,
      orderedPoints[0].y,
      orderedPoints[1].x,
      orderedPoints[1].y,
      orderedPoints[2].x,
      orderedPoints[2].y,
      orderedPoints[3].x,
      orderedPoints[3].y,
    ]);

    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      maxWidth - 1,
      0,
      maxWidth - 1,
      maxHeight - 1,
      0,
      maxHeight - 1,
    ]);

    // Get perspective transform matrix
    const M = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // Apply perspective transformation
    cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight));

    // Convert back to ImageData
    const resultImageData = new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows);

    // Cleanup
    srcPoints.delete();
    dstPoints.delete();
    M.delete();

    return resultImageData;
  } finally {
    src.delete();
    dst.delete();
  }
}

/**
 * Ordina i punti in ordine: top-left, top-right, bottom-right, bottom-left
 */
function orderPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  // Sort by y coordinate
  const sorted = [...points].sort((a, b) => a.y - b.y);

  // Top two points
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  // Bottom two points
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [top[0], top[1], bottom[1], bottom[0]];
}

/**
 * Auto-crop e enhance dell'immagine
 */
function enhanceImage(imageData: ImageData): ImageData {
  if (!isInitialized || !cv) {
    throw new Error('OpenCV not initialized');
  }

  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const enhanced = new cv.Mat();

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply adaptive threshold for better contrast
    cv.adaptiveThreshold(
      gray,
      enhanced,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      11,
      2
    );

    // Convert back to RGBA
    const result = new cv.Mat();
    cv.cvtColor(enhanced, result, cv.COLOR_GRAY2RGBA);

    // Convert to ImageData
    const resultImageData = new ImageData(
      new Uint8ClampedArray(result.data),
      result.cols,
      result.rows
    );

    result.delete();
    return resultImageData;
  } finally {
    src.delete();
    gray.delete();
    enhanced.delete();
  }
}

// Message handler
self.addEventListener('message', async ({ data }: MessageEvent<ImageProcessingMessage>) => {
  try {
    switch (data.type) {
      case 'init':
        await initializeOpenCV();
        break;

      case 'detectEdges':
        if (data.payload?.imageData) {
          const edges = detectDocumentEdges(data.payload.imageData, data.payload.options);
          self.postMessage({
            type: 'result',
            payload: { edges: edges || undefined },
          } as ImageProcessingResponse);
        }
        break;

      case 'correctPerspective':
        if (data.payload?.imageData && data.payload?.points) {
          const correctedImage = correctPerspective(data.payload.imageData, data.payload.points);
          self.postMessage({
            type: 'result',
            payload: { imageData: correctedImage || undefined },
          } as ImageProcessingResponse);
        }
        break;

      case 'enhance':
        if (data.payload?.imageData) {
          const enhancedImage = enhanceImage(data.payload.imageData);
          self.postMessage({
            type: 'result',
            payload: { imageData: enhancedImage },
          } as ImageProcessingResponse);
        }
        break;

      default:
        self.postMessage({
          type: 'error',
          payload: { error: `Unknown message type: ${data.type}` },
        } as ImageProcessingResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: { error: `Image processing failed: ${error}` },
    } as ImageProcessingResponse);
  }
});
