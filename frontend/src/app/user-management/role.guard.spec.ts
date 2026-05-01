import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RoleGuard } from './role.guard';
import { AuthService } from './auth.service';
import { ActivatedRouteSnapshot } from '@angular/router';

describe('RoleGuard', () => {
    let guard: RoleGuard;
    let authService: jasmine.SpyObj<AuthService>;
    let router: Router;

    beforeEach(() => {
        const authSpy = jasmine.createSpyObj('AuthService', ['getUser']);
        const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            providers: [
                RoleGuard,
                { provide: AuthService, useValue: authSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });

        guard = TestBed.inject(RoleGuard);
        authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
        router = TestBed.inject(Router);
    });

    it('should be created', () => {
        expect(guard).toBeTruthy();
    });

    it('should allow access if user has required role (happy path)', () => {
        authService.getUser.and.returnValue({ role: 'admin' });
        const route = { data: { roles: ['admin', 'student'] } } as any as ActivatedRouteSnapshot;

        expect(guard.canActivate(route)).toBeTrue();
    });

    it('should block access and redirect if user role does not match (error path)', () => {
        authService.getUser.and.returnValue({ role: 'student' });
        const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;

        expect(guard.canActivate(route)).toBeFalse();
        expect(router.navigate).toHaveBeenCalledWith(['/student-dashboard']);
    });

    it('should redirect to login if user is not authenticated (edge case)', () => {
        authService.getUser.and.returnValue(null);
        const route = { data: { roles: ['admin'] } } as any as ActivatedRouteSnapshot;

        expect(guard.canActivate(route)).toBeFalse();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
});
