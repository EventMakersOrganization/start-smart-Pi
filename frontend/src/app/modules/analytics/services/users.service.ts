import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/analytics.models';
import { apiUrl } from '../../../core/api-url';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly apiUrl = apiUrl('/api/user');
  private readonly adminApiUrl = apiUrl('/api/admin');

  constructor(private http: HttpClient) {}

  getUserCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`);
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.adminApiUrl}/users`);
  }
}
