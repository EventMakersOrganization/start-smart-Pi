import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('LoginComponent', () => {
    let component: LoginComponent;
    let fixture: ComponentFixture<LoginComponent>;
    let authService: jasmine.SpyObj<AuthService>;
    let adaptiveService: jasmine.SpyObj<AdaptiveLearningService>;
    let router: Router;

    beforeEach(async () => {
        const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'getUser', 'login']);
        const adaptiveSpy = jasmine.createSpyObj('AdaptiveLearningService', ['someMethod']); // Add methods as needed

        await TestBed.configureTestingModule({
            declarations: [LoginComponent],
            imports: [ReactiveFormsModule, RouterTestingModule],
            providers: [
                { provide: AuthService, useValue: authSpy },
                { provide: AdaptiveLearningService, useValue: adaptiveSpy }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        }).compileComponents();

        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
        adaptiveService = TestBed.inject(AdaptiveLearningService) as jasmine.SpyObj<AdaptiveLearningService>;
        router = TestBed.inject(Router);

        // Default mock behavior
        authService.isAuthenticated.and.returnValue(false);
        authService.getUser.and.returnValue(null);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Form Validation', () => {
        it('should be invalid when empty', () => {
            expect(component.loginForm.valid).toBeFalse();
        });

        it('should be invalid with incorrect email format (validation path)', () => {
            component.loginForm.controls['email'].setValue('invalid-email');
            component.loginForm.controls['password'].setValue('123456');
            expect(component.loginForm.valid).toBeFalse();
        });

        it('should be valid with correct details (happy path)', () => {
            component.loginForm.controls['email'].setValue('test@test.com');
            component.loginForm.controls['password'].setValue('password');
            expect(component.loginForm.valid).toBeTrue();
        });
    });

    describe('onSubmit', () => {
        it('should navigate to student dashboard on successful login as student (happy path)', () => {
            const navigateSpy = spyOn(router, 'navigate');
            component.loginForm.controls['email'].setValue('student@test.com');
            component.loginForm.controls['password'].setValue('password');

            authService.login.and.returnValue(of({ token: 'tok', user: { id: '1', role: 'student' } }));
            authService.getUser.and.returnValue({ role: 'student' });

            component.onSubmit();

            expect(authService.login).toHaveBeenCalled();
            expect(navigateSpy).toHaveBeenCalledWith(['/student-dashboard']);
        });

        it('should show error message on login failure (error path)', () => {
            component.loginForm.controls['email'].setValue('test@test.com');
            component.loginForm.controls['password'].setValue('wrong');

            authService.login.and.returnValue(throwError({ status: 401 }));

            component.onSubmit();

            expect(component.errorMessage).toBe('Invalid email or password.');
            expect(component.isSubmitting).toBeFalse();
        });

        it('should not submit if form is invalid (edge case)', () => {
            component.loginForm.controls['email'].setValue('');
            component.onSubmit();
            expect(authService.login).not.toHaveBeenCalled();
        });
    });
});
