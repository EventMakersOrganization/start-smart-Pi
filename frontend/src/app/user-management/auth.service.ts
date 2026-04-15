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
  private userKey = 'authUser';
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private analyticsService: AnalyticsService,
  ) {
    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      const decoded = this.decodeToken(token);
      if (!decoded || this.isTokenExpired(decoded)) {
        this.clearSession();
      } else {
        const storedUser = this.readStoredUser();
        const decodedId = String(decoded.id || '').trim();
        const storedId = String(storedUser?.id || storedUser?._id || '').trim();
        const sameUser = !!decodedId && !!storedId && decodedId === storedId;
        const safeStoredUser = sameUser ? storedUser : null;
        const mergedUser = {
          ...(safeStoredUser || {}),
          id: decoded.id,
          _id: decoded.id,
          email: decoded.email || safeStoredUser?.email,
          // Always trust token role for current session; stored role can be stale.
          role: this.normalizeRole(decoded.role || safeStoredUser?.role),
        };
        localStorage.setItem(this.userKey, JSON.stringify(mergedUser));
        localStorage.setItem('userRole', this.normalizeRole(mergedUser.role));
        this.userSubject.next(mergedUser);
      }
    }
  }

  register(user: { first_name: string; last_name: string; phone?: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, user);
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(response => {
        this.analyticsService.clearSharedAnalyticsCache();
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem('userRole', this.normalizeRole(response.user.role));
        const normalizedUser = this.normalizeLoginUser(response.user);
        localStorage.setItem(this.userKey, JSON.stringify(normalizedUser));
        this.userSubject.next(normalizedUser);
      })
    );
  }

  loginWithGoogle(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login/google`, { idToken }).pipe(
      tap(response => {
        this.analyticsService.clearSharedAnalyticsCache();
        localStorage.setItem(this.tokenKey, response.token);
        localStorage.setItem('userRole', this.normalizeRole(response.user.role));
        const normalizedUser = this.normalizeLoginUser(response.user);
        localStorage.setItem(this.userKey, JSON.stringify(normalizedUser));
        this.userSubject.next(normalizedUser);
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
    this.clearSession();
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    const decoded = this.decodeToken(token);
    if (!decoded || this.isTokenExpired(decoded)) {
      this.clearSession();
      this.userSubject.next(null);
      return false;
    }
    return true;
  }

  getUser(): any {
    return this.userSubject.value;
  }

  private decodeToken(token: string): any {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.sub,
        email: payload.email,
        role: this.normalizeRole(payload.role),
        exp: Number(payload.exp || 0),
      };
    } catch {
      return null;
    }
  }

  private normalizeLoginUser(user: LoginResponse['user']): any {
    return {
      ...user,
      id: user.id,
      _id: user.id,
      role: this.normalizeRole(user.role),
    };
  }

  private normalizeRole(role: unknown): string {
    return String(role || '').trim().toLowerCase();
  }

  private isTokenExpired(decodedToken: any): boolean {
    const exp = Number(decodedToken?.exp || 0);
    if (!exp) {
      return false;
    }
    return Date.now() >= exp * 1000;
  }

  private readStoredUser(): any | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('userRole');
  }
}
