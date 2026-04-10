import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';
import { WebinarService } from '../../webinar/services/webinar.service';
import { Webinar } from '../../webinar/services/webinar.interface';

@Component({
  selector: 'app-instructor-shell',
  templateUrl: './instructor-shell.component.html',
  styleUrls: ['./instructor-shell.component.css'],
})
export class InstructorShellComponent implements OnInit {
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
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
      },
      error: () => {
        /* optional */
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

  /** Highlights top nav when any instructor analytics route is active. */
  get analyticsSectionActive(): boolean {
    const u = this.router.url.split('?')[0];
    return (
      u.includes('/instructor/dashboard') ||
      u.includes('/instructor/deep-analytics') ||
      u.includes('/instructor/risk-detection') ||
      u.includes('/instructor/comprehensive-analytics') ||
      u.includes('/instructor/interventions')
    );
  }

  get subjectsSectionActive(): boolean {
    return this.router.url.includes('/instructor/subjects');
  }
}
