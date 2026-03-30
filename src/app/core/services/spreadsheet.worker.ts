/// <reference lib="webworker" />

import * as XLSX from 'xlsx';
import {
  SpreadsheetWorkerJsonRow,
  SpreadsheetWorkerRequest,
  SpreadsheetWorkerResponse,
} from './spreadsheet-worker.types';

const buildWorkbookFromRows = (rows: SpreadsheetWorkerJsonRow[]): XLSX.WorkBook => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return workbook;
};

const readWorkbookFromBuffer = (arrayBuffer: ArrayBuffer): XLSX.WorkBook =>
  XLSX.read(arrayBuffer, {
    type: 'array',
    cellFormula: true,
    cellStyles: true,
    sheetStubs: true,
  });

const getPrimaryWorksheet = (workbook: XLSX.WorkBook): XLSX.WorkSheet => {
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    throw new Error('Spreadsheet does not contain any readable sheet');
  }

  return worksheet;
};

const writeWorkbookAsXlsx = (workbook: XLSX.WorkBook): ArrayBuffer =>
  XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    bookSST: false,
  }) as ArrayBuffer;

const toResponse = (
  request: SpreadsheetWorkerRequest,
  result: SpreadsheetWorkerJsonRow[] | string | ArrayBuffer
): SpreadsheetWorkerResponse => ({
  id: request.id,
  success: true,
  result,
});

addEventListener('message', ({ data }: MessageEvent<SpreadsheetWorkerRequest>) => {
  try {
    let response: SpreadsheetWorkerResponse;

    switch (data.type) {
      case 'rows-to-xlsx':
        response = toResponse(data, writeWorkbookAsXlsx(buildWorkbookFromRows(data.rows)));
        break;

      case 'rows-to-html':
        response = toResponse(
          data,
          XLSX.utils.sheet_to_html(getPrimaryWorksheet(buildWorkbookFromRows(data.rows)))
        );
        break;

      case 'rows-to-txt':
        response = toResponse(
          data,
          XLSX.utils.sheet_to_txt(getPrimaryWorksheet(buildWorkbookFromRows(data.rows)))
        );
        break;

      case 'binary-to-json': {
        const workbook = readWorkbookFromBuffer(data.arrayBuffer);
        response = toResponse(
          data,
          XLSX.utils.sheet_to_json(getPrimaryWorksheet(workbook)) as SpreadsheetWorkerJsonRow[]
        );
        break;
      }

      case 'binary-to-html': {
        const workbook = readWorkbookFromBuffer(data.arrayBuffer);
        response = toResponse(data, XLSX.utils.sheet_to_html(getPrimaryWorksheet(workbook)));
        break;
      }

      case 'binary-to-txt': {
        const workbook = readWorkbookFromBuffer(data.arrayBuffer);
        response = toResponse(data, XLSX.utils.sheet_to_txt(getPrimaryWorksheet(workbook)));
        break;
      }

      case 'binary-to-xlsx': {
        const workbook = readWorkbookFromBuffer(data.arrayBuffer);
        response = toResponse(data, writeWorkbookAsXlsx(workbook));
        break;
      }
    }

    const transferables =
      response.success && response.result instanceof ArrayBuffer ? [response.result] : [];
    postMessage(response, transferables);
  } catch (error) {
    const response: SpreadsheetWorkerResponse = {
      id: data.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown spreadsheet worker error',
    };
    postMessage(response);
  }
});
