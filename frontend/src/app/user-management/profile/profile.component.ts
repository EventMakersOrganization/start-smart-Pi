import { AuthService } from '../auth.service';
import { FaceRecognitionService } from '../face-recognition.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private faceRecognitionService: FaceRecognitionService,
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

  // Face Registration properties
  isFaceRegActive = false;
  isFaceLoading = false;
  cameraError = '';
  faceSuccess = '';
  faceError = '';
  @ViewChild('video') videoElement!: any;

  async toggleFaceRegistration() {
    this.isFaceRegActive = !this.isFaceRegActive;
    if (this.isFaceRegActive) {
      this.isFaceLoading = true;
      this.cameraError = '';
      try {
        await this.faceRecognitionService.loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.nativeElement.srcObject = stream;
        this.isFaceLoading = false;
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          this.cameraError = 'Camera access denied. Please allow camera permissions.';
        } else if (err.name === 'NotFoundError') {
          this.cameraError = 'No camera found on this device.';
        } else {
          this.cameraError = `Camera Error: ${err.message || err.name || 'Unknown error'}`;
        }
        this.isFaceLoading = false;
      }
    } else {
      this.stopWebcam();
    }
  }

  async captureFace() {
    if (this.isFaceLoading || !this.videoElement) return;

    this.isFaceLoading = true;
    try {
      const detection = await this.faceRecognitionService.detectFace(this.videoElement.nativeElement);
      if (detection) {
        const user = this.authService.getUser();
        const userId = user.id || user._id;
        this.authService.registerFace(userId, detection.descriptor).subscribe({
          next: () => {
            this.faceSuccess = 'Face registered successfully!';
            this.stopWebcam();
            setTimeout(() => this.faceSuccess = '', 3000);
          },
          error: (err) => {
            this.faceError = `Server Error: ${err.error?.message || err.message || 'Failed to register face'}`;
            this.isFaceLoading = false;
          }
        });
      } else {
        this.faceError = 'No face detected. Please try again.';
        this.isFaceLoading = false;
      }
    } catch (err: any) {
      this.faceError = `Detection Error: ${err.message || 'Error during face detection'}`;
      this.isFaceLoading = false;
    }
  }

  private stopWebcam() {
    if (this.videoElement?.nativeElement?.srcObject) {
      const tracks = this.videoElement.nativeElement.srcObject.getTracks();
      tracks.forEach((track: any) => track.stop());
    }
    this.isFaceRegActive = false;
    this.isFaceLoading = false;
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isFaceLoading = true;
    this.faceError = '';
    this.faceSuccess = '';

    try {
      await this.faceRecognitionService.loadModels();

      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = async () => {
        const descriptor = await this.faceRecognitionService.getFaceDescriptorFromImage(img);
        if (descriptor) {
          const user = this.authService.getUser();
          const userId = user.id || user._id;
          this.authService.registerFace(userId, descriptor).subscribe({
            next: () => {
              this.faceSuccess = 'Face registration from image successful!';
              this.isFaceLoading = false;
              setTimeout(() => this.faceSuccess = '', 3000);
            },
            error: (err) => {
              this.faceError = `Server Error: ${err.error?.message || err.message || 'Failed to register face'}`;
              this.isFaceLoading = false;
            }
          });
        } else {
          this.faceError = 'No face detected in the uploaded image.';
          this.isFaceLoading = false;
        }
      };
    } catch (err) {
      this.faceError = 'Error processing image.';
      this.isFaceLoading = false;
    }
  }

  ngOnInit() {
    this.loadProfile();
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
