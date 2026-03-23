import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AiService } from '../../services/ai.service';

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
  suggestedCourses: any[] = [
    { title: 'Advanced Calculus', reason: 'Based on your interest in Math', content: '' },
    { title: 'Machine Learning Basics', reason: 'Aligned with your AI focus', content: '' }
  ];

  showProfileSidebar = false;

  // NEW AI-related state
  allCourses: any[] = [];
  aiRecommendations: any[] = [];
  searchQuery: string = '';
  searchResults: any[] = [];
  showSearchResults: boolean = false;
  generatedQuestion: any = null;
  showQuestionModal: boolean = false;
  showAnswer: boolean = false;
  loadingRecommendations: boolean = false;
  loadingSearch: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private aiService: AiService,
  ) { }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadProfile();
    this.loadCourses();
    this.loadAIRecommendations();
  }

  loadProfile() {
    this.http.get<any>('http://localhost:3000/api/user/profile').subscribe({
      next: (data) => {
        this.profileData = data;
        // Merge phone into the user object for easy access
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

  openBrainRush() {
    alert('Opening BrainRush...');
  }

  openAIEvaluations() {
    alert('Opening AI Evaluations...');
  }

  viewRecommendations() {
    this.loadAIRecommendations();
    alert('AI is analyzing your profile and generating personalized recommendations...');
  }

  startAITutor() {
    const subject = 'Programming'; // TODO: personalize based on student profile
    const difficulty = 'medium';
    const topic = 'general';

    this.aiService.generateQuestion(subject, difficulty, topic).subscribe({
      next: (question) => {
        this.generatedQuestion = question?.question;
        this.showQuestionModal = true;
        this.showAnswer = false;
      },
      error: (err) => {
        console.error('Error generating question:', err);
        alert('AI Tutor is starting... Please wait.');
      }
    });
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

  // -------------------------
  // NEW AI methods
  // -------------------------

  loadCourses() {
    this.aiService.getCourses().subscribe({
      next: (courses) => {
        // backend might return {data: []} or []
        const list = Array.isArray(courses) ? courses : (courses?.data ?? courses?.items ?? []);
        this.allCourses = list;
        console.log('Loaded courses:', this.allCourses.length);
      },
      error: (err) => {
        console.error('Error loading courses:', err);
      }
    });
  }

  loadAIRecommendations() {
    this.loadingRecommendations = true;
    const query = 'beginner programming courses'; // TODO: personalize based on student profile

    this.aiService.searchCourses(query, 3).subscribe({
      next: (results) => {
        const list = results?.results ?? [];
        this.suggestedCourses = list.map((r: any) => ({
          title: r.title || r.course_id,
          reason: `AI Match Score: ${(Number(r.similarity ?? 0) * 100).toFixed(0)}%`,
          content: r.content,
          similarity: r.similarity
        }));
        this.loadingRecommendations = false;
      },
      error: (err) => {
        console.error('Error loading AI recommendations:', err);
        this.loadingRecommendations = false;
        // Keep mock data as fallback
      }
    });
  }

  searchCoursesWithAI() {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      return;
    }

    this.loadingSearch = true;
    this.showSearchResults = true;

    this.aiService.searchCourses(this.searchQuery, 5).subscribe({
      next: (results) => {
        this.searchResults = results?.results || [];
        this.loadingSearch = false;
      },
      error: (err) => {
        console.error('Error searching courses:', err);
        this.loadingSearch = false;
      }
    });
  }

  closeQuestionModal() {
    this.showQuestionModal = false;
    this.generatedQuestion = null;
    this.showAnswer = false;
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  getOptionLabel(i: number): string {
    return String.fromCharCode(65 + i);
  }
}
