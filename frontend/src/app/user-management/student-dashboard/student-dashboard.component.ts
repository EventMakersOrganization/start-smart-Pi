import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AdaptiveLearningService }
  from '../adaptive-learning.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit {
  user: any;
  profileData: any = null;

  // Adaptive Learning
  adaptiveProfile: any = null;
  recommendations: any[] = [];
  performances: any[] = [];
  adaptiveLoading = true;

  // Stats
  progress = 0;
  performance = 0;
  completedModules = 0;
  totalModules = 20;
  learningStreak = 0;
  studyHours = 0;

  goalTracking: any = {
    studyHoursCompleted: 12,
    studyHoursGoal: 15,
    quizSuccess: 85
  };

  progressRings: any[] = [
    { description: 'Completed Math Module 3', date: '2023-10-01' },
    { description: 'Scored 90% on Physics Quiz', date: '2023-09-28' },
    { description: 'Joined AI Tutor Session', date: '2023-09-27' }
  ];

  alerts: any[] = [];
  showProfileSidebar = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private adaptiveService: AdaptiveLearningService
  ) { }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadProfile();
    if (this.user) {
      this.loadAdaptiveData();
    }
  }

  loadProfile() {
    this.http.get<any>('http://localhost:3000/api/user/profile')
      .subscribe({
        next: (data) => {
          this.profileData = data;
          if (this.user && data?.user?.phone) {
            this.user.phone = data.user.phone;
          }
        },
        error: () => { }
      });
  }

  loadAdaptiveData(): void {
    const userId = this.user._id || this.user.id;

    // Charger profil adaptatif
    this.adaptiveService.getProfile(userId).subscribe({
      next: (data) => {
        this.adaptiveProfile = data;
        this.progress = data.progress || 0;
        this.adaptiveLoading = false;
        this.updateAlerts();
      },
      error: () => {
        // Créer profil si inexistant
        this.adaptiveService.createProfile({
          userId: userId,
          level: 'beginner',
          progress: 0,
          strengths: [],
          weaknesses: []
        }).subscribe({
          next: (data) => {
            this.adaptiveProfile = data;
            this.adaptiveLoading = false;
          },
          error: () => {
            this.adaptiveLoading = false;
          }
        });
      }
    });

    // Charger performances
    this.adaptiveService.getPerformances(userId).subscribe({
      next: (data) => {
        this.performances = data;
        if (data.length > 0) {
          const total = data.reduce(
            (sum: number, p: any) => sum + p.score, 0
          );
          this.performance = Math.round(total / data.length);

          // Calculate studyHours from timeSpent (assuming timeSpent in minutes)
          const totalMinutes = data.reduce((sum: number, p: any) => sum + (p.timeSpent || 0), 0);
          this.studyHours = Math.round((totalMinutes / 60) * 10) / 10;

          this.goalTracking = {
            studyHoursCompleted: this.studyHours,
            studyHoursGoal: 15,
            quizSuccess: this.performance
          };

          this.completedModules =
            data.filter((p: any) => p.score >= 70).length;
          this.learningStreak = this.calculateStreak(data);
        }
      },
      error: () => { }
    });

    // Charger recommandations
    this.adaptiveService.getRecommendations(userId).subscribe({
      next: (data) => {
        this.recommendations = data;
        this.updateAlerts();
      },
      error: () => { this.recommendations = []; }
    });
  }

  updateAlerts(): void {
    this.alerts = [];

    if (this.adaptiveProfile?.weaknesses?.length > 0) {
      this.alerts.push({
        type: 'warning',
        message: `Weaknesses detected in: ${this.adaptiveProfile.weaknesses.join(', ')}.`
      });
    }

    if (this.recommendations.length > 0) {
      this.alerts.push({
        type: 'info',
        message: `${this.recommendations.length} new AI recommendations available!`
      });
    }

    if (this.adaptiveProfile && !this.adaptiveProfile.levelTestCompleted) {
      this.alerts.push({
        type: 'info',
        message: 'Complete your Level Test to get personalized recommendations!'
      });
    }
  }

  calculateStreak(performances: any[]): number {
    if (performances.length === 0) return 0;
    const dates = performances.map((p: any) =>
      new Date(p.attemptDate).toDateString()
    );
    const uniqueDates = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff = (
        new Date(uniqueDates[i]).getTime() -
        new Date(uniqueDates[i + 1]).getTime()
      ) / (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }

  startLevelTest(): void {
    const userId = this.user._id || this.user.id;
    this.adaptiveService.startLevelTest(userId).subscribe({
      next: (test) => {
        alert(`Level Test started! ID: ${test._id}`);
      },
      error: () => alert('Error starting level test')
    });
  }

  logout() { this.authService.logout(); }
  openBrainRush() { alert('Opening BrainRush...'); }
  openAIEvaluations() { alert('Opening AI Evaluations...'); }
  viewRecommendations() { alert('Viewing Recommendations...'); }
  startAITutor() { alert('Starting AI Tutor...'); }
  openProfileSidebar() { this.showProfileSidebar = true; }
  closeProfileSidebar() { this.showProfileSidebar = false; }
  manageAccount() {
    this.closeProfileSidebar();
    this.router.navigate(['/profile']);
  }
}