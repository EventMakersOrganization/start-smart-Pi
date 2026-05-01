import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-instructor-layout',
  templateUrl: './instructor-layout.component.html',
  styleUrls: ['./instructor-layout.component.css'],
})
export class InstructorLayoutComponent implements OnInit {
  user: any;
  profileData: any = null;
  showProfileSidebar = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadProfile();
  }

  loadProfile(): void {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
      },
      error: () => {
        /* silently fail */
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  openProfileSidebar(): void {
    this.showProfileSidebar = true;
  }

  closeProfileSidebar(): void {
    this.showProfileSidebar = false;
  }

  manageAccount(): void {
    this.closeProfileSidebar();
    this.router.navigate(['/profile']);
  }
}
