import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WebinarService } from '../../webinar/services/webinar.service';
import { Webinar } from '../../webinar/services/webinar.interface';
import { apiUrl } from '../../core/api-url';

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
    private webinarService: WebinarService,
  ) { }

  liveWebinar: Webinar | null = null;

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadProfile();
    this.checkLiveWebinar();
  }

  checkLiveWebinar() {
    this.webinarService.getWebinars().subscribe(webinars => {
      this.liveWebinar = webinars.find(w => w.status === 'live') || null;
    });
  }

  loadProfile(): void {
    this.http.get<any>(apiUrl('/api/user/profile')).subscribe({
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
