import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdaptiveLearningService } from '../adaptive-learning.service';

@Component({
  selector: 'app-level-test-result',
  templateUrl: './level-test-result.component.html',
  styleUrls: ['./level-test-result.component.css'],
})
export class LevelTestResultComponent implements OnInit {
  result: any = null;
  totalTimeSeconds = 0;
  recommendations: any[] = [];
  loadingRecs = true;

  // Stats par topic calculées depuis les réponses
  topicStats: { topic: string; correct: number; total: number; percent: number }[] = [];

  // Explication AI
  aiExplanation = '';

  constructor(
    private router: Router,
    private adaptiveService: AdaptiveLearningService
  ) {}

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation?.()?.extras?.state as any;
    this.result =
      nav?.['result'] ||
      (history.state && history.state['result']) ||
      null;

    if (!this.result) {
      this.router.navigate(['/student-dashboard']);
      return;
    }

    // Calcul temps total
    this.totalTimeSeconds = (this.result.answers || []).reduce(
      (s: number, a: any) => s + (a.timeSpent || 0),
      0
    );

    // Calcul stats par topic
    this.calculateTopicStats();

    // Génère explication AI
    this.generateAIExplanation();

    // Charge recommandations depuis MongoDB
    if (this.result.studentId) {
      this.loadRecommendations(this.result.studentId);
    }
  }

  calculateTopicStats(): void {
    const topicMap: Record<string, { correct: number; total: number }> = {};

    (this.result.questions || []).forEach((q: any, index: number) => {
      const topic = q.topic || 'General';
      if (!topicMap[topic]) {
        topicMap[topic] = { correct: 0, total: 0 };
      }
      topicMap[topic].total++;

      const answer = this.result.answers?.[index];
      if (answer?.isCorrect) {
        topicMap[topic].correct++;
      }
    });

    this.topicStats = Object.entries(topicMap).map(([topic, stat]) => ({
      topic,
      correct: stat.correct,
      total: stat.total,
      percent: Math.round((stat.correct / stat.total) * 100)
    }));
  }

  generateAIExplanation(): void {
    const score = this.result.totalScore || 0;
    const level = this.result.resultLevel || 'beginner';
    const total = this.result.questions?.length || 0;
    const correct = Math.round((score / 100) * total);

    const weakTopics = this.topicStats
      .filter(t => t.percent < 50)
      .map(t => t.topic);

    const strongTopics = this.topicStats
      .filter(t => t.percent >= 70)
      .map(t => t.topic);

    let explanation = `You answered ${correct} out of ${total} questions correctly (${score}%). `;

    if (strongTopics.length > 0) {
      explanation += `You showed strong mastery in ${strongTopics.join(', ')}. `;
    }

    if (weakTopics.length > 0) {
      explanation += `However, your performance in ${weakTopics.join(', ')} was below 50%. `;
    }

    if (level === 'advanced') {
      explanation += `Therefore, the system assigned you the Advanced level — you are ready for complex challenges!`;
    } else if (level === 'intermediate') {
      explanation += `Therefore, the system assigned Intermediate level — you have solid foundations but need to strengthen some areas.`;
    } else {
      explanation += `Therefore, the system assigned Beginner level — focus on building core concepts first.`;
    }

    this.aiExplanation = explanation;
  }

  loadRecommendations(studentId: string): void {
    this.adaptiveService.getRecommendations(studentId).subscribe({
      next: (data) => {
        this.recommendations = data;
        this.loadingRecs = false;
      },
      error: () => {
        this.recommendations = [];
        this.loadingRecs = false;
      }
    });
  }

  getLevelColor(): string {
    const level = this.result?.resultLevel;
    if (level === 'advanced') return 'emerald';
    if (level === 'intermediate') return 'blue';
    return 'orange';
  }

  getLevelIcon(): string {
    const level = this.result?.resultLevel;
    if (level === 'advanced') return 'emoji_events';
    if (level === 'intermediate') return 'trending_up';
    return 'school';
  }

  getLevelMessage(): string {
    const level = this.result?.resultLevel;
    const score = this.result?.totalScore || 0;
    if (level === 'advanced') {
      return `Outstanding! You scored ${score}%. You're ready for advanced challenges!`;
    } else if (level === 'intermediate') {
      return `Great progress! You scored ${score}%. Focus on weak areas to reach Advanced level.`;
    }
    return `Good start! You scored ${score}%. Build your foundations step by step.`;
  }

  getTopicColor(percent: number): string {
    if (percent >= 70) return 'emerald';
    if (percent >= 50) return 'blue';
    return 'orange';
  }

  retakeTest(): void {
    this.router.navigate(['/student-dashboard']);
  }

  startLearning(): void {
    this.router.navigate(['/student-dashboard']);
  }

  goDashboard(): void {
    this.router.navigate(['/student-dashboard']);
  }

  formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }
}