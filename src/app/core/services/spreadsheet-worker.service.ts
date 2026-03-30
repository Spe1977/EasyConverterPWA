import { Injectable } from '@angular/core';
import {
  SpreadsheetWorkerJsonRow,
  SpreadsheetWorkerPayload,
  SpreadsheetWorkerRequest,
  SpreadsheetWorkerResponse,
} from './spreadsheet-worker.types';

@Injectable({
  providedIn: 'root',
})
export class SpreadsheetWorkerService {
  private workerPromise?: Promise<Worker | null>;
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (value: SpreadsheetWorkerJsonRow[] | string | ArrayBuffer) => void;
      reject: (reason?: unknown) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();
  private requestCounter = 0;
  private xlsxModule?: typeof import('xlsx');
  private static readonly REQUEST_TIMEOUT_MS = 120_000; // 2 minutes per request

  async convertRowsToXlsx(rows: SpreadsheetWorkerJsonRow[]): Promise<ArrayBuffer> {
    return this.execute({ type: 'rows-to-xlsx', rows }) as Promise<ArrayBuffer>;
  }

  async convertRowsToHtml(rows: SpreadsheetWorkerJsonRow[]): Promise<string> {
    return this.execute({ type: 'rows-to-html', rows }) as Promise<string>;
  }

  async convertRowsToTxt(rows: SpreadsheetWorkerJsonRow[]): Promise<string> {
    return this.execute({ type: 'rows-to-txt', rows }) as Promise<string>;
  }

  async readWorkbookAsJson(arrayBuffer: ArrayBuffer): Promise<SpreadsheetWorkerJsonRow[]> {
    return this.execute({ type: 'binary-to-json', arrayBuffer }, [arrayBuffer]) as Promise<
      SpreadsheetWorkerJsonRow[]
    >;
  }

  async readWorkbookAsHtml(arrayBuffer: ArrayBuffer): Promise<string> {
    return this.execute({ type: 'binary-to-html', arrayBuffer }, [arrayBuffer]) as Promise<string>;
  }

  async readWorkbookAsTxt(arrayBuffer: ArrayBuffer): Promise<string> {
    return this.execute({ type: 'binary-to-txt', arrayBuffer }, [arrayBuffer]) as Promise<string>;
  }

  async normalizeWorkbookToXlsx(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    return this.execute({ type: 'binary-to-xlsx', arrayBuffer }, [
      arrayBuffer,
    ]) as Promise<ArrayBuffer>;
  }

  private async execute(
    payload: SpreadsheetWorkerPayload,
    transferables: Transferable[] = []
  ): Promise<SpreadsheetWorkerJsonRow[] | string | ArrayBuffer> {
    const request: SpreadsheetWorkerRequest = {
      ...payload,
      id: `spreadsheet-worker-${this.requestCounter++}`,
    } as SpreadsheetWorkerRequest;

    const worker = await this.getWorker();
    if (!worker) {
      return this.executeFallback(request);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = this.pendingRequests.get(request.id);
        if (pending) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Spreadsheet worker request timed out'));
        }
      }, SpreadsheetWorkerService.REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(request.id, { resolve, reject, timeoutId });

      try {
        worker.postMessage(request, transferables);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(request.id);
        this.disableWorker();
        void this.executeFallback(request).then(resolve).catch(reject);
      }
    });
  }

  private async getWorker(): Promise<Worker | null> {
    if (!this.workerPromise) {
      this.workerPromise = this.createWorker();
    }

    return this.workerPromise;
  }

  private async createWorker(): Promise<Worker | null> {
    if (typeof Worker === 'undefined') {
      return null;
    }

    try {
      const worker = new Worker(new URL('./spreadsheet.worker', import.meta.url), {
        type: 'module',
      });

      worker.addEventListener('message', (event: MessageEvent<SpreadsheetWorkerResponse>) => {
        this.resolveWorkerResponse(event.data);
      });

      worker.addEventListener('error', (event) => {
        this.rejectAllPending(
          event.error ?? new Error(event.message || 'Spreadsheet worker error')
        );
        worker.terminate();
        this.disableWorker();
      });

      return worker;
    } catch {
      return null;
    }
  }

  private resolveWorkerResponse(response: SpreadsheetWorkerResponse): void {
    const pendingRequest = this.pendingRequests.get(response.id);
    if (!pendingRequest) {
      return;
    }

    clearTimeout(pendingRequest.timeoutId);
    this.pendingRequests.delete(response.id);

    if (!response.success) {
      pendingRequest.reject(new Error(response.error));
      return;
    }

    pendingRequest.resolve(response.result);
  }

  private rejectAllPending(reason: unknown): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(reason);
    }
    this.pendingRequests.clear();
  }

  private disableWorker(): void {
    this.workerPromise = Promise.resolve(null);
  }

  private async getXlsxModule(): Promise<typeof import('xlsx')> {
    if (!this.xlsxModule) {
      this.xlsxModule = await import('xlsx');
    }

    return this.xlsxModule;
  }

  private async executeFallback(
    request: SpreadsheetWorkerRequest
  ): Promise<SpreadsheetWorkerJsonRow[] | string | ArrayBuffer> {
    const XLSX = await this.getXlsxModule();

    const buildWorkbookFromRows = (rows: SpreadsheetWorkerJsonRow[]): import('xlsx').WorkBook => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      return workbook;
    };

    const readWorkbookFromBuffer = (arrayBuffer: ArrayBuffer): import('xlsx').WorkBook =>
      XLSX.read(arrayBuffer, {
        type: 'array',
        cellFormula: true,
        cellStyles: true,
        sheetStubs: true,
      });

    const getPrimaryWorksheet = (workbook: import('xlsx').WorkBook): import('xlsx').WorkSheet => {
      const sheetName = workbook.SheetNames[0];
      const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

      if (!worksheet) {
        throw new Error('Spreadsheet does not contain any readable sheet');
      }

      return worksheet;
    };

    switch (request.type) {
      case 'rows-to-xlsx':
        return XLSX.write(buildWorkbookFromRows(request.rows), {
          type: 'array',
          bookType: 'xlsx',
          bookSST: false,
        }) as ArrayBuffer;

      case 'rows-to-html':
        return XLSX.utils.sheet_to_html(getPrimaryWorksheet(buildWorkbookFromRows(request.rows)));

      case 'rows-to-txt':
        return XLSX.utils.sheet_to_txt(getPrimaryWorksheet(buildWorkbookFromRows(request.rows)));

      case 'binary-to-json':
        return XLSX.utils.sheet_to_json(
          getPrimaryWorksheet(readWorkbookFromBuffer(request.arrayBuffer))
        ) as SpreadsheetWorkerJsonRow[];

      case 'binary-to-html':
        return XLSX.utils.sheet_to_html(
          getPrimaryWorksheet(readWorkbookFromBuffer(request.arrayBuffer))
        );

      case 'binary-to-txt':
        return XLSX.utils.sheet_to_txt(
          getPrimaryWorksheet(readWorkbookFromBuffer(request.arrayBuffer))
        );

      case 'binary-to-xlsx':
        return XLSX.write(readWorkbookFromBuffer(request.arrayBuffer), {
          type: 'array',
          bookType: 'xlsx',
          bookSST: false,
        }) as ArrayBuffer;
    }
  }
}
