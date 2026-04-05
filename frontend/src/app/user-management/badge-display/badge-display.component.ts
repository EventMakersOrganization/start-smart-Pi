import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  AchievementBadge,
  AchievementBadgesResponse,
  AdaptiveLearningService,
} from '../adaptive-learning.service';
import { AuthService } from '../auth.service';

type BadgeFilter = 'all' | 'performance' | 'progress' | 'topic' | 'milestone';

@Component({
  selector: 'app-badge-display',
  templateUrl: './badge-display.component.html',
})
export class BadgeDisplayComponent implements OnInit, OnChanges {
  @Input() studentId: string | null = null;

  loading = false;
  error = '';

  filter: BadgeFilter = 'all';
  badges: AchievementBadge[] = [];
  filteredBadges: AchievementBadge[] = [];

  stats = {
    totalBadges: 15,
    earnedBadges: 0,
    completionRate: 0,
    lastEarnedBadge: null as AchievementBadge | null,
  };

  constructor(
    private adaptiveService: AdaptiveLearningService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.studentId = this.studentId || this.resolveStudentId();
    this.loadBadges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] && !changes['studentId'].firstChange) {
      this.loadBadges();
    }
  }

  setFilter(next: BadgeFilter): void {
    this.filter = next;
    this.applyFilter();
  }

  getCategoryChipClass(category: string): string {
    if (category === 'performance') return 'bg-blue-100 text-blue-700';
    if (category === 'progress') return 'bg-violet-100 text-violet-700';
    if (category === 'topic') return 'bg-emerald-100 text-emerald-700';
    return 'bg-amber-100 text-amber-700';
  }

  getBadgeCardClass(badge: AchievementBadge): string {
    if (badge.earned) {
      return [
        'border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white',
        'shadow-[0_8px_24px_rgba(245,158,11,0.20)]',
      ].join(' ');
    }

    return [
      'border border-slate-200 bg-slate-50 opacity-40 grayscale',
      'shadow-none',
    ].join(' ');
  }

  formatEarnedDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  trackByBadge(_: number, badge: AchievementBadge): string {
    return badge.id;
  }

  private loadBadges(): void {
    if (!this.studentId) {
      this.badges = [];
      this.filteredBadges = [];
      this.stats = {
        totalBadges: 15,
        earnedBadges: 0,
        completionRate: 0,
        lastEarnedBadge: null,
      };
      return;
    }

    this.loading = true;
    this.error = '';

    this.adaptiveService.getAchievementBadges(this.studentId).subscribe({
      next: (res: AchievementBadgesResponse) => {
        const payload = res || ({} as AchievementBadgesResponse);
        this.badges = Array.isArray(payload.badges) ? payload.badges : [];

        const sortedEarned = this.badges
          .filter((badge) => badge.earned)
          .sort((a, b) => {
            const aTime = a.earnedAt ? new Date(a.earnedAt).getTime() : 0;
            const bTime = b.earnedAt ? new Date(b.earnedAt).getTime() : 0;
            return bTime - aTime;
          });

        this.stats = {
          totalBadges: payload.totalBadges || 15,
          earnedBadges: payload.earnedBadges || sortedEarned.length,
          completionRate:
            payload.completionRate ||
            (this.badges.length > 0
              ? Math.round((sortedEarned.length / this.badges.length) * 10000) /
                100
              : 0),
          lastEarnedBadge: sortedEarned[0] || null,
        };

        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les badges.';
        this.badges = [];
        this.filteredBadges = [];
        this.loading = false;
      },
    });
  }

  private applyFilter(): void {
    if (this.filter === 'all') {
      this.filteredBadges = [...this.badges];
      return;
    }

    this.filteredBadges = this.badges.filter(
      (badge) => badge.category === this.filter,
    );
  }

  private resolveStudentId(): string | null {
    const user = this.authService.getUser();
    return user?._id || user?.id || null;
  }
}
