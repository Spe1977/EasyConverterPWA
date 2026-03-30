export interface SpreadsheetWorkerJsonRow {
  [key: string]: unknown;
}

export type SpreadsheetWorkerRequest =
  | {
      id: string;
      type: 'rows-to-xlsx';
      rows: SpreadsheetWorkerJsonRow[];
    }
  | {
      id: string;
      type: 'rows-to-html';
      rows: SpreadsheetWorkerJsonRow[];
    }
  | {
      id: string;
      type: 'rows-to-txt';
      rows: SpreadsheetWorkerJsonRow[];
    }
  | {
      id: string;
      type: 'binary-to-json';
      arrayBuffer: ArrayBuffer;
    }
  | {
      id: string;
      type: 'binary-to-html';
      arrayBuffer: ArrayBuffer;
    }
  | {
      id: string;
      type: 'binary-to-txt';
      arrayBuffer: ArrayBuffer;
    }
  | {
      id: string;
      type: 'binary-to-xlsx';
      arrayBuffer: ArrayBuffer;
    };

export type SpreadsheetWorkerPayload = SpreadsheetWorkerRequest extends infer T
  ? T extends { id: string }
    ? Omit<T, 'id'>
    : never
  : never;

export type SpreadsheetWorkerResponse =
  | {
      id: string;
      success: true;
      result: SpreadsheetWorkerJsonRow[] | string | ArrayBuffer;
    }
  | {
      id: string;
      success: false;
      error: string;
    };
