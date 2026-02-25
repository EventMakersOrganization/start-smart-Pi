import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-instructor-dashboard',
  templateUrl: './instructor-dashboard.component.html',
  styleUrls: ['./instructor-dashboard.component.css']
})
export class InstructorDashboardComponent implements OnInit {
  user: any;
  profileData: any = null;
  showProfileSidebar = false;

  constructor(private authService: AuthService, private router: Router, private http: HttpClient) { }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadProfile();
  }

  loadProfile() {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
      },
      error: () => { /* silently fail */ }
    });
  }

  logout() {
    this.authService.logout();
  }

  openProfileSidebar() {
    this.showProfileSidebar = true;
  }

  closeProfileSidebar() {
    this.showProfileSidebar = false;
  }

  manageAccount() {
    this.closeProfileSidebar();
    this.router.navigate(['/profile']);
  }
}
