import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  exportToCSV(data: Record<string, any>[], filename: string): void {
    if (!data || data.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    saveAs(blob, this.ensureExtension(filename, 'csv'));
  }

  exportToExcel(data: Record<string, any>[], filename: string): void {
    if (!data || data.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    saveAs(blob, this.ensureExtension(filename, 'xlsx'));
  }

  private ensureExtension(filename: string, extension: 'csv' | 'xlsx'): string {
    const normalized = filename.trim();
    const suffix = `.${extension}`;

    if (normalized.toLowerCase().endsWith(suffix)) {
      return normalized;
    }

    return `${normalized}${suffix}`;
  }
}
