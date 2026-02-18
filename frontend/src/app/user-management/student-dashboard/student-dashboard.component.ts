import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit {
  user: any;
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

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.user = this.authService.getUser();
  }

  logout() {
    this.authService.logout();
  }

  openBrainRush() {
    // Mock action
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
}
