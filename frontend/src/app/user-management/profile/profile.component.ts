import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../auth.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

interface ProfileData {
  user: {
    id: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    role: string;
    status: string;
    avatar?: string;
  };
  profile: {
    academic_level: string;
    risk_level: string;
    points_gamification: number;
  } | null;
}

function passwordMatch(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('new_password');
  const confirm = control.get('confirm_password');
  if (newPwd && confirm && newPwd.value !== confirm.value) {
    confirm.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  if (confirm?.hasError('passwordMismatch')) {
    confirm.setErrors(null);
  }
  return null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  profileData: ProfileData | null = null;
  isEditing = false;
  isUploadingAvatar = false;
  selectedAvatarName = '';
  errorMessage = '';
  successMessage = '';
  pwdErrorMessage = '';
  pwdSuccessMessage = '';

  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      first_name: [''],
      last_name: [''],
      phone: [''],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: passwordMatch });
  }

  ngOnInit() {
    this.loadProfile();
  }

  private getEffectiveUserId(): string | null {
    return this.profileData?.user?.id || this.authService.getUser()?.id || null;
  }

  private getApiErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
    if (error?.status === 0) {
      return 'Cannot reach backend server. Please make sure API is running on port 3000.';
    }

    if (error?.status === 401) {
      return 'Your session expired. Please log in again.';
    }

    const message = error?.error?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return message || fallbackMessage;
  }

  loadProfile() {
    this.http.get<ProfileData>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        const currentUser = this.authService.getUser() || {};
        this.authService.setUser({
          ...currentUser,
          ...data.user,
        });
        this.profileForm.patchValue({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          phone: (data.user as any).phone || '',
        });
        this.errorMessage = '';
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.getApiErrorMessage(error, 'Failed to load profile.');
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';
    this.selectedAvatarName = '';
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.errorMessage = 'Unable to detect your user ID. Please log out and log in again.';
      input.value = '';
      return;
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedMimeTypes.includes(file.type)) {
      this.errorMessage = 'Only image files are allowed (JPEG, PNG, GIF, WebP).';
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      this.errorMessage = 'File size must not exceed 5MB.';
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.isUploadingAvatar = true;
    this.selectedAvatarName = file.name;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<any>(`http://localhost:3000/api/user/${userId}/avatar`, formData).subscribe({
      next: (updatedUser) => {
        if (this.profileData?.user) {
          this.profileData = {
            ...this.profileData,
            user: {
              ...this.profileData.user,
              avatar: updatedUser?.avatar,
            },
          };
        }

        const currentUser = this.authService.getUser() || {};
        this.authService.setUser({
          ...currentUser,
          avatar: updatedUser?.avatar,
          first_name: updatedUser?.first_name ?? currentUser.first_name,
          last_name: updatedUser?.last_name ?? currentUser.last_name,
          phone: updatedUser?.phone ?? currentUser.phone,
        });

        this.successMessage = 'Profile image updated successfully!';
        setTimeout(() => this.successMessage = '', 3000);
        this.isUploadingAvatar = false;
        input.value = '';
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.getApiErrorMessage(error, 'Failed to upload profile image.');
        this.isUploadingAvatar = false;
        input.value = '';
      }
    });
  }

  onSubmit() {
    if (this.profileForm.valid) {
      this.http.put<ProfileData>('http://localhost:3000/api/user/profile', this.profileForm.value).subscribe({
        next: (data) => {
          this.profileData = data;
          const currentUser = this.authService.getUser() || {};
          this.authService.setUser({
            ...currentUser,
            ...data.user,
          });
          this.successMessage = 'Profile updated successfully!';
          this.isEditing = false;
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.getApiErrorMessage(error, 'Failed to update profile.');
        }
      });
    }
  }

  changePassword() {
    if (this.passwordForm.valid) {
      const { current_password, new_password } = this.passwordForm.value;
      this.http.put('http://localhost:3000/api/user/change-password', { current_password, new_password }).subscribe({
        next: () => {
          this.pwdSuccessMessage = 'Password changed successfully!';
          this.passwordForm.reset();
          setTimeout(() => this.pwdSuccessMessage = '', 3000);
        },
        error: () => {
          this.pwdErrorMessage = 'Failed to change password. Check your current password.';
          setTimeout(() => this.pwdErrorMessage = '', 4000);
        }
      });
    }
  }

  navigateBack() {
    const user = this.authService.getUser();
    if (user?.role === 'instructor') {
      this.router.navigate(['/instructor/dashboard']);
    } else if (user?.role === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/student-dashboard']);
    }
  }

  logout() {
    this.authService.logout();
  }
}
