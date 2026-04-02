import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  showPassword = false;
  isSubmitting = false; // Prevent duplicate submissions

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  ngAfterViewInit(): void {
    const clientId = environment.googleClientId;
    if (!clientId) {
      console.error('Google Client ID is not configured in environment.ts');
      return;
    }

    const renderGoogleButton = () => {
      const googleGlobal = (window as any).google;
      const buttonElement = document.getElementById('googleButton');

      if (
        !googleGlobal ||
        !googleGlobal.accounts ||
        !googleGlobal.accounts.id ||
        !buttonElement
      ) {
        // Try again shortly if the script or element is not ready yet
        setTimeout(renderGoogleButton, 500);
        return;
      }

      googleGlobal.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => this.handleCredentialResponse(response),
      });

      googleGlobal.accounts.id.renderButton(buttonElement, {
        theme: 'outline',
        size: 'large',
      });
    };

    renderGoogleButton();
  }

  ngOnDestroy(): void {
    // cleanup if needed
  }

  handleCredentialResponse(response: any) {
    const idToken = response?.credential;
    if (!idToken) return;

    this.isSubmitting = true;
    this.authService.loginWithGoogle(idToken).subscribe({
      next: (res) => {
        const user = this.authService.getUser();
        if (user?.role === 'student') {
          const userId = user._id || user.id;
          this.adaptiveService.getProfile(userId).subscribe({
            next: (profile) => {
              if (!profile || !profile.level) {
                this.router.navigate(['/level-test']);
              } else {
                this.router.navigate(['/student-dashboard']);
              }
            },
            error: () => {
              // If profile not found or error, redirect to level test
              this.router.navigate(['/level-test']);
            },
          });
        } else if (user?.role === 'instructor') {
          this.router.navigate(['/instructor/dashboard']);
        } else if (user?.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/profile']);
        }
      },
      error: () => {
        this.errorMessage = 'Google login failed.';
        this.isSubmitting = false;
      },
    });
  }

  onSubmit() {
    if (this.loginForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      this.errorMessage = '';

      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          const user = this.authService.getUser();
          if (user.role === 'student') {
            const userId = user._id || user.id;
            this.adaptiveService.getProfile(userId).subscribe({
              next: (profile) => {
                if (!profile || !profile.level) {
                  this.router.navigate(['/level-test']);
                } else {
                  this.router.navigate(['/student-dashboard']);
                }
              },
              error: () => this.router.navigate(['/level-test']),
            });
          } else if (user.role === 'instructor') {
            this.router.navigate(['/instructor/dashboard']);
          } else if (user.role === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/profile']);
          }
          // isSubmitting flag will be reset on navigation
        },
        error: (error) => {
          // Handle specific HTTP errors
          if (error.status === 429) {
            this.errorMessage =
              'Too many login attempts. Please wait a moment and try again.';
          } else if (error.status === 401 || error.status === 400) {
            this.errorMessage = 'Invalid email or password.';
          } else {
            this.errorMessage = 'Login failed. Please check your credentials.';
          }
          this.isSubmitting = false;
        },
      });
    }
  }
}
