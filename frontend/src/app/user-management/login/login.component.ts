import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
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

      if (!googleGlobal || !googleGlobal.accounts || !googleGlobal.accounts.id || !buttonElement) {
        // Try again shortly if the script or element is not ready yet
        setTimeout(renderGoogleButton, 500);
        return;
      }

      googleGlobal.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => this.handleCredentialResponse(response),
      });

      googleGlobal.accounts.id.renderButton(
        buttonElement,
        { theme: 'outline', size: 'large' }
      );
    };

    renderGoogleButton();
  }

  ngOnDestroy(): void {
    // cleanup if needed
  }

  handleCredentialResponse(response: any) {
    const idToken = response?.credential;
    if (!idToken) return;

    this.authService.loginWithGoogle(idToken).subscribe({
      next: (res) => {
        const user = this.authService.getUser();
        if (user?.role === 'student') {
          this.router.navigate(['/student-dashboard']);
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
      }
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          const user = this.authService.getUser();
          if (user.role === 'student') {
            this.router.navigate(['/student-dashboard']);
          } else if (user.role === 'instructor') {
            this.router.navigate(['/instructor/dashboard']);
          } else if (user.role === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/profile']);
          }
        },
        error: (error) => {
          this.errorMessage = 'Login failed. Please check your credentials.';
        }
      });
    }
  }
}
