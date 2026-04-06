import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit {
  user: any;
  profileData: any = null;
  progress = 75; // Mock progress percentage
  performance = 85; // Mock performance score
  completedModules = 12;
  totalModules = 20;
  learningStreak = 7; // Days
  recentActivities = [
    { description: 'Completed Math Module 3', date: '2023-10-01' },
    { description: 'Scored 90% on Physics Quiz', date: '2023-09-28' },
    { description: 'Joined AI Tutor Session', date: '2023-09-27' }
  ];
  alerts = [
    { type: 'warning', message: 'Your performance in Chemistry is below average. Consider reviewing the modules.' },
    { type: 'info', message: 'New AI recommendations available for your learning path.' }
  ];
  suggestedCourses = [
    { title: 'Advanced Calculus', reason: 'Based on your interest in Math' },
    { title: 'Machine Learning Basics', reason: 'Aligned with your AI focus' }
  ];

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
        this.user = {
          ...(this.user || {}),
          ...(data?.user || {}),
          academic_level: data?.profile?.academic_level,
          risk_level: data?.profile?.risk_level,
          points_gamification: data?.profile?.points_gamification,
        };
      },
      error: () => { /* silently fail */ }
    });
  }

  logout() {
    this.authService.logout();
  }

  openBrainRush() {
    alert('Opening BrainRush...');
  }

  openAIEvaluations() {
    alert('Opening AI Evaluations...');
  }

  viewRecommendations() {
    alert('Viewing Recommendations...');
  }

  startAITutor() {
    alert('Starting AI Tutor...');
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
