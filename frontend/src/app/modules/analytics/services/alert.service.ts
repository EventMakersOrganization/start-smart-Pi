import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Alert } from '../models/analytics.models';
import { apiUrl, socketBaseUrl, publicApiOrigin, assetUrl } from '../../../core/api-url';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private apiUrl = apiUrl('/api/alerts');

  constructor(private http: HttpClient) {}

  getAllAlerts(): Observable<Alert[]> {
    return this.http.get<Alert[]>(this.apiUrl);
  }

  getUnresolvedAlerts(): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/unresolved`);
  }

  getAlertById(id: string): Observable<Alert> {
    return this.http.get<Alert>(`${this.apiUrl}/${id}`);
  }

  getAlertsByStudent(studentId: string): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/student/${studentId}`);
  }

  getAlertsByInstructor(instructorId: string): Observable<Alert[]> {
    return this.http.get<Alert[]>(`${this.apiUrl}/instructor/${instructorId}`);
  }

  createAlert(alert: Partial<Alert>): Observable<Alert> {
    return this.http.post<Alert>(this.apiUrl, alert);
  }

  updateAlert(id: string, alert: Partial<Alert>): Observable<Alert> {
    return this.http.patch<Alert>(`${this.apiUrl}/${id}`, alert);
  }

  resolveAlert(id: string): Observable<Alert> {
    return this.http.patch<Alert>(`${this.apiUrl}/${id}/resolve`, {});
  }

  deleteAlert(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getAlertCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`);
  }
}
