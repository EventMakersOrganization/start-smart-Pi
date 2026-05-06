import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/api-url';

@Injectable({
  providedIn: 'root'
})
export class ChatApiService {
  private readonly apiUrl = apiUrl('/api/chat');

  constructor(private http: HttpClient) {}

  getSessions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sessions`);
  }

  getHistory(sessionType: string, sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/history/${sessionType}/${sessionId}`);
  }

  createAiSession(title?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/session`, { title });
  }

  createInstructorSession(instructorId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/instructor/session`, { instructorId });
  }

  createRoom(name: string, participants: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/room`, { name, participants });
  }

  addMembersToRoom(roomId: string, participants: string[]): Observable<any> {
    return this.http.patch(`${this.apiUrl}/room/${roomId}/members`, { participants });
  }

  leaveRoom(roomId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/room/${roomId}/leave`, {});
  }

  renameRoom(roomId: string, name: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/room/${roomId}/rename`, { name });
  }

  uploadAvatar(roomId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post(`${this.apiUrl}/room/${roomId}/avatar`, formData);
  }

  uploadAttachments(files: FileList): Observable<any[]> {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    return this.http.post<any[]>(`${this.apiUrl}/upload-attachments`, formData);
  }

  getUsersByRole(role: string): Observable<any> {
    const t = new Date().getTime();
    return this.http.get(apiUrl(`/api/user?role=${role}&t=${t}`));
  }

  getAvailableInstructors(): Observable<any> {
    return this.http.get(`${this.apiUrl}/instructors/available`);
  }

  semanticSearch(query: string, nResults = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai/search`, {
      params: { q: query, n: nResults.toString() },
    });
  }

  aiHealthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/ai/health`);
  }

  deleteAiSession(sessionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ai/session/${sessionId}`);
  }

  deleteInstructorSession(sessionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/instructor/session/${sessionId}`);
  }

  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/room/${roomId}`);
  }
}
