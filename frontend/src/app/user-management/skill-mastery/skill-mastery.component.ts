import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdaptiveLearningService } from '../adaptive-learning.service';

interface SkillLevel {
  level: string;
  minScore: number;
  color: string;
  bgColor: string;
  starColor: string;
  icon: string;
}

interface SkillTopic {
  topic: string;
  score: number;
  attempts: number;
  averageScore: number;
  proficiency: string;
  source: 'strength' | 'weakness' | 'neutral';
  stars: number;
}

type FilterType = 'all' | 'strengths' | 'weaknesses' | 'in-progress';

@Component({
  selector: 'app-skill-mastery',
  templateUrl: './skill-mastery.component.html',
  styleUrls: ['./skill-mastery.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkillMasteryComponent implements OnInit, OnDestroy, OnChanges {
  @Input() studentId: string | null = null;
  @Input() adaptiveProfile: any = null;

  skills: SkillTopic[] = [];
  filteredSkills: SkillTopic[] = [];
  currentFilter: FilterType = 'all';
  loading = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  skillLevels: SkillLevel[] = [
    {
      level: 'Expert',
      minScore: 90,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      starColor: 'text-yellow-500',
      icon: 'star',
    },
    {
      level: 'Advanced',
      minScore: 75,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      starColor: 'text-blue-500',
      icon: 'star_half',
    },
    {
      level: 'Proficient',
      minScore: 60,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200',
      starColor: 'text-emerald-500',
      icon: 'grade',
    },
    {
      level: 'Learning',
      minScore: 40,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      starColor: 'text-orange-500',
      icon: 'trending_up',
    },
    {
      level: 'Beginner',
      minScore: 0,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 border-slate-200',
      starColor: 'text-slate-400',
      icon: 'circle',
    },
  ];

  constructor(
    private adaptiveService: AdaptiveLearningService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSkills();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] || changes['adaptiveProfile']) {
      this.loadSkills();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSkills(): void {
    this.error = null;
    this.loading = true;

    if (!this.studentId) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.adaptiveService
      .getExerciseCompletionTracking(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (trackingData) => {
          this.skills = this.processTrackingData(trackingData);
          this.applyFilter('all');
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load skill tracking data:', err);
          this.error = 'Impossible de charger les données de compétences';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private processTrackingData(trackingData: any): SkillTopic[] {
    const topics: SkillTopic[] = [];

    if (Array.isArray(trackingData?.byTopic)) {
      trackingData.byTopic.forEach((item: any) => {
        const averageScore = Number(item.averageScore) || 0;
        const skillLevel = this.getSkillLevel(averageScore);
        const source = this.determineSource(item.topic, averageScore);

        topics.push({
          topic: this.capitalizeTopic(item.topic || 'general'),
          score: averageScore,
          attempts: Number(item.attempts) || 0,
          averageScore: averageScore,
          proficiency: skillLevel.level,
          source: source,
          stars: this.getStarCount(skillLevel.level),
        });
      });
    }

    return topics.sort((a, b) => b.score - a.score);
  }

  private determineSource(
    topic: string,
    score: number,
  ): 'strength' | 'weakness' | 'neutral' {
    if (!this.adaptiveProfile) return 'neutral';

    const strengths = this.adaptiveProfile.strengths || [];
    const weaknesses = this.adaptiveProfile.weaknesses || [];

    const topicLower = (topic || 'general').toLowerCase();
    const isStrength = strengths.some(
      (s: any) => (s.topic || '').toLowerCase() === topicLower,
    );
    const isWeakness = weaknesses.some(
      (w: any) => (w.topic || '').toLowerCase() === topicLower,
    );

    if (isStrength) return 'strength';
    if (isWeakness) return 'weakness';
    return 'neutral';
  }

  private getSkillLevel(score: number): SkillLevel {
    return (
      this.skillLevels.find((level) => score >= level.minScore) ||
      this.skillLevels[this.skillLevels.length - 1]
    );
  }

  private getStarCount(level: string): number {
    switch (level) {
      case 'Expert':
        return 5;
      case 'Advanced':
        return 4;
      case 'Proficient':
        return 3;
      case 'Learning':
        return 2;
      default:
        return 1;
    }
  }

  private capitalizeTopic(topic: string): string {
    return topic
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  applyFilter(filter: FilterType): void {
    this.currentFilter = filter;

    switch (filter) {
      case 'strengths':
        this.filteredSkills = this.skills.filter((s) => s.source === 'strength');
        break;
      case 'weaknesses':
        this.filteredSkills = this.skills.filter((s) => s.source === 'weakness');
        break;
      case 'in-progress':
        this.filteredSkills = this.skills.filter(
          (s) =>
            s.proficiency === 'Learning' ||
            s.proficiency === 'Beginner',
        );
        break;
      default:
        this.filteredSkills = [...this.skills];
    }

    this.cdr.markForCheck();
  }

  getSkillLevelConfig(proficiency: string): SkillLevel | undefined {
    return this.skillLevels.find((level) => level.level === proficiency);
  }

  getSourceBadgeClass(source: 'strength' | 'weakness' | 'neutral'): string {
    switch (source) {
      case 'strength':
        return 'bg-emerald-100 text-emerald-700';
      case 'weakness':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  getSourceLabel(source: 'strength' | 'weakness' | 'neutral'): string {
    switch (source) {
      case 'strength':
        return 'Force';
      case 'weakness':
        return 'Faiblesse';
      default:
        return 'Neutre';
    }
  }

  getStarArray(count: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  getStarCountForLevel(level: string): number {
    return this.getStarCount(level);
  }
}
