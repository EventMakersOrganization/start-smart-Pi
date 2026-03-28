import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { AdaptiveLearningService } from '../adaptive-learning.service';

@Component({
  selector: 'app-recommendation-display',
  templateUrl: './recommendation-display.component.html',
  styleUrls: ['./recommendation-display.component.css'],
})
export class RecommendationDisplayComponent implements OnInit {
  @Input() recommendations: any[] = [];
  @Input() studentId: string = '';
  @Output() recommendationViewed = new EventEmitter<string>();

  selectedFilter = 'all';
  isGenerating = false;
  expandedId: string | null = null;

  constructor(private adaptiveService: AdaptiveLearningService) {}

  ngOnInit(): void {}

  get filtered(): any[] {
    if (this.selectedFilter === 'all') return this.recommendations;
    return this.recommendations.filter(
      (r) => r.contentType === this.selectedFilter,
    );
  }

  get exerciseCount(): number {
    return this.recommendations.filter((r) => r.contentType === 'exercise')
      .length;
  }

  get courseCount(): number {
    return this.recommendations.filter((r) => r.contentType === 'course')
      .length;
  }

  get unviewedCount(): number {
    return this.recommendations.filter((r) => !r.isViewed).length;
  }

  markAsViewed(rec: any): void {
    if (rec.isViewed) return;
    this.adaptiveService.markRecommendationViewed(rec._id).subscribe({
      next: () => {
        rec.isViewed = true;
        this.recommendationViewed.emit(rec._id);
      },
      error: () => {},
    });
  }

  generateNew(): void {
    if (!this.studentId) return;
    this.isGenerating = true;

    const applyRecommendations = (data: any): void => {
      const items = Array.isArray(data?.recommendations)
        ? data.recommendations
        : Array.isArray(data)
          ? data
          : [];
      this.recommendations = items;
      this.isGenerating = false;
    };

    this.adaptiveService.generateRecommendationsV2(this.studentId).subscribe({
      next: (data) => {
        applyRecommendations(data);
      },
      error: () => {
        // Keep v1 as fallback path while preferring v2 (ai-service-backed).
        this.adaptiveService.generateRecommendations(this.studentId).subscribe({
          next: (data) => {
            applyRecommendations(data);
          },
          error: () => {
            this.isGenerating = false;
          },
        });
      },
    });
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  getGradient(index: number): string {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-pink-600',
      'from-violet-500 to-indigo-600',
      'from-cyan-500 to-blue-600',
    ];
    return gradients[index % gradients.length];
  }

  getIcon(contentType: string): string {
    if (contentType === 'course') return 'school';
    if (contentType === 'topic') return 'menu_book';
    return 'assignment';
  }

  getConfidenceLabel(score: number): string {
    if (score >= 80) return 'High Match';
    if (score >= 60) return 'Good Match';
    return 'Suggested';
  }

  getConfidenceColor(score: number): string {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}
