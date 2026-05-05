import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../auth.service';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { AdaptiveLearningService } from '../adaptive-learning.service';

interface ProfileData {
  user: {
    id: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    role: string;
    status: string;
  };
  profile: {
    class: string;
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

export type ProfileTab = 'account' | 'goals' | 'badges' | 'security';

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
  errorMessage = '';
  successMessage = '';
  pwdErrorMessage = '';
  pwdSuccessMessage = '';

  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;

  activeTab: ProfileTab = 'account';
  studentLevel = '—';

  get isStudent(): boolean {
    return String(this.authService.getUser()?.role || '').toLowerCase() === 'student';
  }

  get studentId(): string | null {
    const user = this.authService.getUser();
    return user?._id || user?.id || null;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private adaptiveLearningService: AdaptiveLearningService
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
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'] as ProfileTab;
      }
    });
  }

  setTab(tab: ProfileTab): void {
    this.activeTab = tab;
  }

  loadProfile() {
    this.http.get<ProfileData>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        this.profileForm.patchValue({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          phone: (data.user as any).phone || '',
        });

        const userId = this.studentId;
        if (userId) {
          this.adaptiveLearningService.getProfile(userId).subscribe({
            next: (adaptiveProfile: any) => {
              this.studentLevel = String(adaptiveProfile?.level || adaptiveProfile?.currentLevel || '—');
            },
            error: () => {
              this.studentLevel = '—';
            }
          });
        }
      },
      error: () => {
        this.errorMessage = 'Failed to load profile.';
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onSubmit() {
    if (this.profileForm.valid) {
      this.http.put('http://localhost:3000/api/user/profile', this.profileForm.value).subscribe({
        next: () => {
          this.successMessage = 'Profile updated successfully!';
          this.isEditing = false;
          this.loadProfile();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: () => {
          this.errorMessage = 'Failed to update profile.';
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

  /** Route for brand logo / home navigation in the profile header. */
  homeDashboardLink(): string {
    const user = this.authService.getUser();
    if (user?.role === 'instructor') return '/instructor/dashboard';
    if (user?.role === 'admin') return '/admin/students';
    return '/student-dashboard';
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
