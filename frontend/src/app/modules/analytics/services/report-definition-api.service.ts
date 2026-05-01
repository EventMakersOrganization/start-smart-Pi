import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReportDefinitionItem {
  _id: string;
  name: string;
  metrics: string[];
  filters: Record<string, string>;
  format: 'csv' | 'xlsx';
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportDefinitionApiService {
  private readonly base = 'http://localhost:3000/api/reports/definitions';

  constructor(private readonly http: HttpClient) {}

  list(): Observable<ReportDefinitionItem[]> {
    return this.http.get<ReportDefinitionItem[]>(this.base);
  }

  create(body: {
    name: string;
    metrics: string[];
    filters?: Record<string, string>;
    format: 'csv' | 'xlsx';
  }): Observable<ReportDefinitionItem> {
    return this.http.post<ReportDefinitionItem>(this.base, body);
  }

  run(id: string): Observable<{ rows: Record<string, unknown>[]; format: string }> {
    return this.http.post<{ rows: Record<string, unknown>[]; format: string }>(
      `${this.base}/${id}/run`,
      {},
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
