import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AnalyticsService } from '../modules/analytics/services/analytics.service';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api';
  private tokenKey = 'authToken';
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private analyticsService: AnalyticsService,
  ) {
    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.userSubject.next(this.decodeToken(token));
    }
  }

  register(user: { first_name: string; last_name: string; phone?: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, user);
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem('userRole', response.user.role);
        this.userSubject.next(response.user);
      })
    );
  }

  loginWithGoogle(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login/google`, { idToken }).pipe(
      tap(response => {
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem('userRole', response.user.role);
        this.userSubject.next(response.user);
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  logout() {
    this.analyticsService.clearSharedAnalyticsCache();
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getUser(): any {
    return this.userSubject.value;
  }

  private decodeToken(token: string): any {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }
}
