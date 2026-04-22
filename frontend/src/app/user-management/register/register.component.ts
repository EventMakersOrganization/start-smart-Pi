import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { FaceRecognitionService } from '../face-recognition.service';
import { ElementRef, ViewChild } from '@angular/core';

function passwordMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirm = control.get('confirm_password');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  if (confirm?.hasError('passwordMismatch')) {
    confirm.setErrors(null);
  }
  return null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = '';
  showPassword = false;
  showConfirm = false;

  @ViewChild('video') videoElement!: ElementRef;
  isFaceLoading = false;
  isFaceCaptured = false;
  isFaceRegActive = false;
  faceDescriptor: number[] | null = null;
  cameraError: string = '';
  faceError: string = '';
  faceSuccess: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private faceRecognitionService: FaceRecognitionService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: passwordMatch });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm() {
    this.showConfirm = !this.showConfirm;
  }

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
    this.isFaceLoading = true;
    this.faceError = '';
    try {
      const detection = await this.faceRecognitionService.detectFace(this.videoElement.nativeElement);
      if (detection) {
        this.faceDescriptor = Array.from(detection.descriptor);
        this.isFaceCaptured = true;
        this.faceSuccess = 'Face captured successfully!';
        this.stopWebcam();
        setTimeout(() => this.faceSuccess = '', 3000);
      } else {
        this.faceError = 'No face detected. Please try again.';
        this.isFaceLoading = false;
      }
    } catch (err: any) {
      this.faceError = `Detection Error: ${err.message || 'Error during face detection'}`;
      this.isFaceLoading = false;
    }
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
          this.faceDescriptor = Array.from(descriptor);
          this.isFaceCaptured = true;
          this.faceSuccess = 'Face registration from image ready!';
          this.isFaceLoading = false;
          setTimeout(() => this.faceSuccess = '', 3000);
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

  private stopWebcam() {
    if (this.videoElement?.nativeElement?.srcObject) {
      const tracks = this.videoElement.nativeElement.srcObject.getTracks();
      tracks.forEach((track: any) => track.stop());
    }
    this.isFaceRegActive = false;
    this.isFaceLoading = false;
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const { confirm_password, ...payload } = this.registerForm.value;
      if (this.faceDescriptor) {
        payload.faceDescriptor = this.faceDescriptor;
      }
      this.authService.register(payload).subscribe({
        next: (response) => {
          this.successMessage = 'Registration successful! Please login.';
          this.registerForm.reset();
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (error) => {
          this.errorMessage = 'Registration failed. Email might already be in use.';
        }
      });
    }
  }
}
