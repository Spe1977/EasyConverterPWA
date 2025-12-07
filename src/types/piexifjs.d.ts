declare module 'piexifjs' {
  export function load(dataUrl: string): any;
  export function dump(exifObj: any): string;
  export function insert(exifBytes: string, dataUrl: string): string;
  export function remove(dataUrl: string): string;
}
