import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AdaptiveLearningService } from '../adaptive-learning.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css'],
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
    studyHoursCompleted: 0,
    studyHoursGoal: 15,
    quizSuccess: 0,
  };

  alerts: any[] = [];
  showProfileSidebar = false;
  activeNav = 'dashboard';

  // Topic scores pour les progress rings
  topicRings: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private adaptiveService: AdaptiveLearningService,
  ) {}

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadProfile();
    if (this.user) {
      this.loadUserInfo();
      this.loadAdaptiveData();
    }
  }

  loadUserInfo(): void {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        // Merge les infos du backend avec le user actuel
        if (data?.user) {
          this.user = { ...this.user, ...data.user };
        } else if (data) {
          this.user = { ...this.user, ...data };
        }
        console.log('✅ User enriched:', this.user);
      },
      error: (err) => {
        console.log('❌ User info error:', err);
      },
    });
  }

  loadProfile() {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        if (this.user && data?.user?.phone) {
          this.user.phone = data.user.phone;
        }
      },
      error: () => {},
    });
  }

  loadAdaptiveData(): void {
    const userId = this.user._id || this.user.id;

    // ── Charger profil adaptatif ──
    this.adaptiveService.getProfile(userId).subscribe({
      next: (data) => {
        this.adaptiveProfile = data;
        this.progress = data.progress || 0;
        this.adaptiveLoading = false;
        this.buildTopicRings();
        this.updateAlerts();
      },
      error: () => {
        this.adaptiveService
          .createProfile({
            userId,
            level: 'beginner',
            progress: 0,
            strengths: [],
            weaknesses: [],
          })
          .subscribe({
            next: (data) => {
              this.adaptiveProfile = data;
              this.adaptiveLoading = false;
              this.updateAlerts();
            },
            error: () => {
              this.adaptiveLoading = false;
            },
          });
      },
    });

    // ── Charger performances ──
    this.adaptiveService.getPerformances(userId).subscribe({
      next: (data) => {
        this.performances = data;
        if (data.length > 0) {
          const total = data.reduce((sum: number, p: any) => sum + p.score, 0);
          this.performance = Math.round(total / data.length);

          const totalMinutes = data.reduce(
            (sum: number, p: any) => sum + (p.timeSpent || 0),
            0,
          );
          this.studyHours = Math.round((totalMinutes / 60) * 10) / 10;

          this.goalTracking = {
            studyHoursCompleted: this.studyHours,
            studyHoursGoal: 15,
            quizSuccess: this.performance,
          };

          this.completedModules = data.filter((p: any) => p.score >= 70).length;
          this.learningStreak = this.calculateStreak(data);
          this.buildTopicRings();
        }
      },
      error: () => {},
    });

    // ── Charger recommandations ──
    this.adaptiveService.getRecommendations(userId).subscribe({
      next: (data) => {
        this.recommendations = data;
        this.updateAlerts();
      },
      error: () => {
        this.recommendations = [];
      },
    });
  }

  // ── Construit les anneaux par topic ──
  buildTopicRings(): void {
    const colors = [
      'text-primary',
      'text-emerald-500',
      'text-orange-500',
      'text-purple-500',
    ];

    if (this.performances.length > 0) {
      // Grouper par topic
      const topicMap: Record<string, { total: number; count: number }> = {};
      this.performances.forEach((p: any) => {
        const t = p.topic || 'general';
        if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
        topicMap[t].total += p.score;
        topicMap[t].count++;
      });

      this.topicRings = Object.entries(topicMap)
        .slice(0, 4)
        .map(([topic, stat], i) => ({
          name: topic,
          score: Math.round(stat.total / stat.count),
          color: colors[i % colors.length],
        }));
    } else if (this.adaptiveProfile) {
      // Fallback : strengths/weaknesses du profil
      const allTopics = [
        ...(this.adaptiveProfile.strengths || []).map((t: string) => ({
          name: t,
          score: 80,
        })),
        ...(this.adaptiveProfile.weaknesses || []).map((t: string) => ({
          name: t,
          score: 35,
        })),
      ].slice(0, 4);

      this.topicRings = allTopics.map((t, i) => ({
        ...t,
        color: colors[i % colors.length],
      }));
    }

    // Fallback si vide
    if (this.topicRings.length === 0) {
      this.topicRings = [
        { name: 'Mathematics', score: 0, color: colors[0] },
        { name: 'Sciences', score: 0, color: colors[1] },
        { name: 'Literature', score: 0, color: colors[2] },
        { name: 'Economics', score: 0, color: colors[3] },
      ];
    }
  }

  updateAlerts(): void {
    this.alerts = [];

    if (!this.adaptiveProfile?.levelTestCompleted) {
      this.alerts.push({
        type: 'warning',
        icon: 'quiz',
        message:
          'Complete your Level Test to get personalized recommendations!',
        action: 'Take Test',
        actionFn: () => this.goToLevelTest(),
      });
    }

    if (this.adaptiveProfile?.weaknesses?.length > 0) {
      this.alerts.push({
        type: 'info',
        icon: 'tips_and_updates',
        message: `Focus areas detected: ${this.adaptiveProfile.weaknesses.slice(0, 3).join(', ')}.`,
      });
    }

    if (this.recommendations.length > 0) {
      this.alerts.push({
        type: 'success',
        icon: 'auto_awesome',
        message: `${this.recommendations.length} personalized recommendations ready for you!`,
      });
    }
  }

  calculateStreak(performances: any[]): number {
    if (performances.length === 0) return 0;
    const dates = performances.map((p: any) =>
      new Date(p.attemptDate).toDateString(),
    );
    const uniqueDates = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff =
        (new Date(uniqueDates[i]).getTime() -
          new Date(uniqueDates[i + 1]).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }

  // ── Navigation ──
  goToLevelTest(): void {
    const userId = this.user._id || this.user.id;
    this.adaptiveService.startLevelTest(userId).subscribe({
      next: (test) => {
        this.router.navigate(['/student-dashboard/level-test'], {
          state: { testId: test._id, test },
        });
      },
      error: () => alert('Error starting level test'),
    });
  }

  openLevelTestFromSidebar(): void {
    const userId = this.user?._id || this.user?.id;
    if (!userId) {
      this.router.navigate(['/student-dashboard/level-test']);
      return;
    }

    this.adaptiveService.getLevelTest(userId).subscribe({
      next: (test) => {
        if (test && test.status === 'completed') {
          this.router.navigate(['/student-dashboard/level-test-result'], {
            state: { result: test },
          });
          return;
        }

        this.router.navigate(['/student-dashboard/level-test']);
      },
      error: () => {
        this.router.navigate(['/student-dashboard/level-test']);
      },
    });
  }

  getLevelColor(): string {
    const level = this.adaptiveProfile?.level;
    if (level === 'advanced') return 'bg-green-100 text-green-700';
    if (level === 'intermediate') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  }

  getLevelIcon(): string {
    const level = this.adaptiveProfile?.level;
    if (level === 'advanced') return 'workspace_premium';
    if (level === 'intermediate') return 'trending_up';
    return 'school';
  }

  getAlertClass(type: string): string {
    if (type === 'warning')
      return 'bg-orange-50 border-orange-200 text-orange-800';
    if (type === 'success')
      return 'bg-green-50 border-green-200 text-green-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }

  getRecommendationGradient(index: number): string {
    const gradients = [
      'from-primary/40 to-purple-600/40',
      'from-emerald-500/40 to-teal-500/40',
      'from-orange-500/40 to-pink-500/40',
      'from-blue-500/40 to-cyan-500/40',
      'from-violet-500/40 to-purple-500/40',
    ];
    return gradients[index % gradients.length];
  }

  getRecommendationColor(index: number): string {
    const colors = [
      'text-primary',
      'text-emerald-500',
      'text-orange-500',
      'text-blue-500',
      'text-violet-500',
    ];
    return colors[index % colors.length];
  }

  getContentTypeLabel(type: string): string {
    if (type === 'course') return 'Course';
    if (type === 'topic') return 'Topic Review';
    return 'Exercise';
  }

  isSubPageView(): boolean {
    return (
      this.router.url.includes('/student-dashboard/level-test') ||
      this.router.url.includes('/student-dashboard/level-test-result') ||
      this.router.url.includes('/student-dashboard/goal-setting') ||
      this.router.url.includes('/student-dashboard/badges') ||
      this.router.url.includes('/student-dashboard/my-courses') ||
      this.router.url.includes('/student-dashboard/performance') ||
      this.router.url.includes('/student-dashboard/learning-path') ||
      this.router.url.includes('/student-dashboard/assignments') ||
      this.router.url.includes('/student-dashboard/continue-learning')
    );
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

  onRecommendationViewed(id: string): void {
    const rec = this.recommendations.find((r) => r._id === id);
    if (rec) rec.isViewed = true;
  }
}
