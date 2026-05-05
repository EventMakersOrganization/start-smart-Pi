import {
  Component,
  OnInit,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';

@Component({
  selector: 'app-performance-history',
  templateUrl: './performance-history.component.html',
  styleUrls: ['./performance-history.component.css'],
})
export class PerformanceHistoryComponent implements OnInit {
  @Input() performances: any[] = [];
  @Input() adaptiveProfile: any = null;
  @Input() studentId: string = '';

  loading = false;

  Math = Math;

  // Filtres
  selectedTopic = 'all';

  sortBy = 'date_desc';

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;

  topics: string[] = [];

  constructor(
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
  ) {}

  ngOnInit(): void {
    if (!this.performances || this.performances.length === 0) {
      this.loadStandaloneData();
      return;
    }

    this.extractTopics();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['performances'] && this.performances) {
      this.currentPage = 1;
    }
    this.extractTopics();
  }

  private loadStandaloneData(): void {
    const user = this.authService.getUser();
    const resolvedStudentId = this.studentId || user?._id || user?.id;

    if (!resolvedStudentId) {
      this.performances = [];
      this.extractTopics();
      return;
    }

    this.studentId = resolvedStudentId;
    this.loading = true;

    if (!this.adaptiveProfile) {
      this.adaptiveService.getProfile(resolvedStudentId).subscribe({
        next: (data) => {
          this.adaptiveProfile = data;
        },
        error: () => {},
      });
    }

    this.adaptiveService.getPerformances(resolvedStudentId).subscribe({
      next: (data) => {
        this.performances = data || [];
        this.extractTopics();
        this.loading = false;
      },
      error: () => {
        this.performances = [];
        this.extractTopics();
        this.loading = false;
      },
    });
  }

  extractTopics(): void {
    const all = this.performances.map((p) => p.topic || 'general');
    this.topics = ['all', ...new Set(all)];
  }

  get filtered(): any[] {
    let data = [...this.performances];

    // Filtre topic
    if (this.selectedTopic !== 'all') {
      data = data.filter((p) => (p.topic || 'general') === this.selectedTopic);
    }

    // Sort
    data.sort((a, b) => {
      if (this.sortBy === 'date_desc')
        return (
          new Date(b.attemptDate).getTime() - new Date(a.attemptDate).getTime()
        );
      if (this.sortBy === 'date_asc')
        return (
          new Date(a.attemptDate).getTime() - new Date(b.attemptDate).getTime()
        );
      if (this.sortBy === 'score_desc') return b.score - a.score;
      if (this.sortBy === 'score_asc') return a.score - b.score;
      return 0;
    });

    return data;
  }

  get paginated(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filtered.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getScoreColor(score: number): string {
    if (score >= 75) return 'text-emerald-600 bg-emerald-50';
    if (score >= 50) return 'text-blue-600 bg-blue-50';
    return 'text-red-500 bg-red-50';
  }

  getScoreBadge(score: number): string {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Good';
    return 'Needs Work';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  resetFilters(): void {
    this.selectedTopic = 'all';

    this.sortBy = 'date_desc';
    this.currentPage = 1;
  }
}
