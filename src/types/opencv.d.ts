/**
 * Type declarations for opencv.js
 * OpenCV.js is the JavaScript binding for OpenCV
 * This file provides minimal type definitions for the features used in this project
 */

declare module 'opencv.js' {
  export interface Mat {
    rows: number;
    cols: number;
    data: Uint8Array;
    data32S: Int32Array;
    delete(): void;
  }

  export interface MatVector {
    size(): number;
    get(index: number): Mat;
    delete(): void;
  }

  export interface Size {
    width: number;
    height: number;
  }

  export interface OpenCV {
    Mat: new () => Mat;
    MatVector: new () => MatVector;
    Size: new (width: number, height: number) => Size;

    // Image conversion
    matFromImageData(imageData: ImageData): Mat;
    matFromArray(rows: number, cols: number, type: number, data: number[]): Mat;

    // Color conversion
    cvtColor(src: Mat, dst: Mat, code: number): void;
    COLOR_RGBA2GRAY: number;
    COLOR_GRAY2RGBA: number;

    // Filtering
    GaussianBlur(src: Mat, dst: Mat, ksize: Size, sigmaX: number): void;
    adaptiveThreshold(
      src: Mat,
      dst: Mat,
      maxValue: number,
      adaptiveMethod: number,
      thresholdType: number,
      blockSize: number,
      C: number
    ): void;
    ADAPTIVE_THRESH_GAUSSIAN_C: number;
    THRESH_BINARY: number;

    // Edge detection
    Canny(src: Mat, dst: Mat, threshold1: number, threshold2: number): void;

    // Contours
    findContours(
      image: Mat,
      contours: MatVector,
      hierarchy: Mat,
      mode: number,
      method: number
    ): void;
    contourArea(contour: Mat): number;
    arcLength(curve: Mat, closed: boolean): number;
    approxPolyDP(curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean): void;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;

    // Geometric transformations
    getPerspectiveTransform(src: Mat, dst: Mat): Mat;
    warpPerspective(src: Mat, dst: Mat, M: Mat, dsize: Size): void;

    // Mat types
    CV_32FC2: number;

    // Initialization
    onRuntimeInitialized?: () => void;
  }

  const cv: OpenCV;
  export default cv;
}
