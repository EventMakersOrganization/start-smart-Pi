import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WebinarService } from '../../webinar/services/webinar.service';
import { ToastService } from '../../shared/services/toast.service';
import { Webinar } from '../../webinar/services/webinar.interface';
import { apiUrl } from '../../core/api-url';

@Component({
  selector: 'app-instructor-dashboard',
  templateUrl: './instructor-dashboard.component.html',
  styleUrls: ['./instructor-dashboard.component.css']
})
export class InstructorDashboardComponent implements OnInit {
  user: any;
  profileData: any = null;
  showProfileSidebar = false;
  liveWebinar: Webinar | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private webinarService: WebinarService,
    private toastService: ToastService
  ) { }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadProfile();
    this.checkWebinars();
  }

  checkWebinars() {
    this.webinarService.getWebinars().subscribe(webinars => {
      this.liveWebinar = webinars.find(w => w.status === 'live') || null;

      // If none are live, check if any are starting soon to notify
      if (!this.liveWebinar) {
        const soon = webinars.find(w => {
          const diff = new Date(w.scheduledStartTime).getTime() - Date.now();
          return diff > 0 && diff < 15 * 60 * 1000;
        });
        if (soon) {
          this.toastService.show(`Your webinar "${soon.title}" starts soon!`, 'info', '/webinar/list', 'Prepare Now');
        }
      }
    });
  }

  loadProfile() {
    this.http.get<any>(apiUrl('/api/user/profile')).subscribe({
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
