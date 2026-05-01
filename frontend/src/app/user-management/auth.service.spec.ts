import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { AnalyticsService } from '../modules/analytics/services/analytics.service';
import { Router } from '@angular/router';

describe('AuthService', () => {
    let service: AuthService;
    let httpMock: HttpTestingController;
    let router: Router;
    let analyticsService: jasmine.SpyObj<AnalyticsService>;

    beforeEach(() => {
        localStorage.clear();
        const analyticsSpy = jasmine.createSpyObj('AnalyticsService', ['clearSharedAnalyticsCache']);

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, RouterTestingModule],
            providers: [
                AuthService,
                { provide: AnalyticsService, useValue: analyticsSpy }
            ]
        });

        service = TestBed.inject(AuthService);
        httpMock = TestBed.inject(HttpTestingController);
        router = TestBed.inject(Router);
        analyticsService = TestBed.inject(AnalyticsService) as jasmine.SpyObj<AnalyticsService>;
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('login', () => {
        it('should store token and user info on success (happy path)', () => {
            const mockResponse = {
                token: 'mock-token',
                user: { id: '1', email: 'test@test.com', role: 'student' }
            };

            service.login({ email: 'test@test.com', password: 'password' }).subscribe(res => {
                expect(res).toEqual(mockResponse);
                expect(localStorage.getItem('authToken')).toBe('mock-token');
                expect(localStorage.getItem('userRole')).toBe('student');
                expect(analyticsService.clearSharedAnalyticsCache).toHaveBeenCalled();
            });

            const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
            expect(req.request.method).toBe('POST');
            req.flush(mockResponse);

            // Handle the immediate heartbeat that follows login
            const heartbeatReq = httpMock.expectOne('http://localhost:3000/api/tracking/heartbeat');
            expect(heartbeatReq.request.method).toBe('POST');
            heartbeatReq.flush({});
        });

        it('should handle login error (error path)', () => {
            service.login({ email: 'test@test.com', password: 'wrong' }).subscribe({
                error: (err) => {
                    expect(err.status).toBe(401);
                }
            });

            const req = httpMock.expectOne('http://localhost:3000/api/auth/login');
            req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        });
    });

    describe('isAuthenticated', () => {
        it('should return false if no token exists', () => {
            expect(service.isAuthenticated()).toBeFalse();
        });

        it('should return true if valid token exists (edge case)', () => {
            const futureDate = Math.floor(Date.now() / 1000) + 3600;
            const payload = btoa(JSON.stringify({ sub: '1', role: 'student', exp: futureDate }));
            const mockToken = `header.${payload}.signature`;

            localStorage.setItem('authToken', mockToken);
            expect(service.isAuthenticated()).toBeTrue();
        });

        it('should return false and clear session if token is expired', () => {
            const pastDate = Math.floor(Date.now() / 1000) - 3600;
            const payload = btoa(JSON.stringify({ sub: '1', role: 'student', exp: pastDate }));
            const mockToken = `header.${payload}.signature`;

            localStorage.setItem('authToken', mockToken);
            expect(service.isAuthenticated()).toBeFalse();
            expect(localStorage.getItem('authToken')).toBeNull();
        });
    });

    describe('logout', () => {
        it('should clear session and navigate to login', () => {
            const navigateSpy = spyOn(router, 'navigate');
            localStorage.setItem('authToken', 'some-token');

            service.logout();

            expect(localStorage.getItem('authToken')).toBeNull();
            expect(navigateSpy).toHaveBeenCalledWith(['/login']);

            const req = httpMock.expectOne('http://localhost:3000/api/auth/logout');
            expect(req.request.method).toBe('POST');
            req.flush({});
        });
    });
});
