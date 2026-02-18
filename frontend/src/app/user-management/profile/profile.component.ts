import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AuthService } from '../auth.service';
import { HttpClient } from '@angular/common/http';

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  profile: {
    academicLevel: string;
    enrolledCourse: string;
    preferences: any;
    averageScore: number;
  } | null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  profileData: ProfileData | null = null;
  isEditing = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.profileForm = this.fb.group({
      name: [''],
      academicLevel: [''],
      enrolledCourse: [''],
      preferences: [{}]
    });
  }

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.http.get<ProfileData>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        this.profileForm.patchValue({
          name: data.user.name,
          academicLevel: data.profile?.academicLevel || '',
          enrolledCourse: data.profile?.enrolledCourse || '',
          preferences: data.profile?.preferences || {}
        });
      },
      error: (error) => {
        this.errorMessage = 'Failed to load profile.';
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
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
        error: (error) => {
          this.errorMessage = 'Failed to update profile.';
        }
      });
    }
  }

  logout() {
    this.authService.logout();
  }
}
