import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AdaptiveLearningService } from '../../user-management/adaptive-learning.service';
import { AuthService } from '../../user-management/auth.service';

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-student-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student-sidebar.component.html',
  styleUrls: ['./student-sidebar.component.css']
})
export class StudentSidebarComponent implements OnInit, OnDestroy {
  activeNav = 'dashboard';
  user: any;
  private routerEventsSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService
  ) { }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.syncActiveNavFromUrl();
    this.routerEventsSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncActiveNavFromUrl(event.urlAfterRedirects));
  }

  ngOnDestroy() {
    this.routerEventsSubscription?.unsubscribe();
  }

  private syncActiveNavFromUrl(url: string = this.router.url): void {
    if (url.includes('/student-dashboard/level-test-result')) {
      this.activeNav = 'level-test-result';
      return;
    }
    if (url.includes('/student-dashboard/level-test')) {
      this.activeNav = 'level-test';
      return;
    }
    if (url.includes('/student-dashboard/my-courses')) {
      this.activeNav = 'my-courses';
      return;
    }
    if (url.includes('/student-dashboard/performance')) {
      this.activeNav = 'performance';
      return;
    }
    if (url.includes('/student-dashboard/learning-path')) {
      this.activeNav = 'learning-path';
      return;
    }
    if (url.includes('/student-dashboard/chat/instructor')) {
      this.activeNav = 'conversations';
      return;
    }
    if (url.includes('/student-dashboard/chat/room')) {
      this.activeNav = 'groups';
      return;
    }
    if (url.includes('/codebattle')) {
      this.activeNav = 'codebattle';
      return;
    }
    this.activeNav = 'dashboard';
  }

  openLevelTestFromSidebar(): void {
    const userId = this.user?._id || this.user?.id;
    if (!userId) {
      this.router.navigate(['/student-dashboard/level-test']);
      return;
    }

    this.adaptiveService.getLatestCompletedLevelTest(userId).subscribe({
      next: (test: any) => {
        if (test && test.status === 'completed') {
          this.router.navigate(['/student-dashboard/level-test-result'], {
            state: { result: test },
          });
        } else {
          this.router.navigate(['/student-dashboard/level-test']);
        }
      },
      error: () => {
        this.router.navigate(['/student-dashboard/level-test']);
      }
    });
  }
}
