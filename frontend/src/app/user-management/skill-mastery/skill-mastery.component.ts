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
  gradientStart: string;
  gradientEnd: string;
  accentRgb: string;
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
      gradientStart: '#f59e0b',
      gradientEnd: '#fbbf24',
      accentRgb: '245, 158, 11',
    },
    {
      level: 'Advanced',
      minScore: 75,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50/50 border-blue-200/50',
      starColor: 'text-blue-500',
      icon: 'military_tech',
      gradientStart: '#2563eb',
      gradientEnd: '#60a5fa',
      accentRgb: '37, 99, 235',
    },
    {
      level: 'Proficient',
      minScore: 60,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50/50 border-emerald-200/50',
      starColor: 'text-emerald-500',
      icon: 'auto_awesome',
      gradientStart: '#059669',
      gradientEnd: '#34d399',
      accentRgb: '5, 150, 105',
    },
    {
      level: 'Learning',
      minScore: 40,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50/50 border-orange-200/50',
      starColor: 'text-orange-500',
      icon: 'cyclone',
      gradientStart: '#ea580c',
      gradientEnd: '#fb923c',
      accentRgb: '234, 88, 12',
    },
    {
      level: 'Beginner',
      minScore: 0,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50/50 border-slate-200/50',
      starColor: 'text-slate-400',
      icon: 'architecture',
      gradientStart: '#475569',
      gradientEnd: '#94a3b8',
      accentRgb: '71, 85, 105',
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
          // Fallback: derive visible skill cards from adaptive profile strengths/weaknesses.
          this.skills = this.buildSkillsFromProfile();
          this.applyFilter('all');
          this.error = null;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildSkillsFromProfile(): SkillTopic[] {
    const strengths = Array.isArray(this.adaptiveProfile?.strengths)
      ? this.adaptiveProfile.strengths
      : [];
    const weaknesses = Array.isArray(this.adaptiveProfile?.weaknesses)
      ? this.adaptiveProfile.weaknesses
      : [];

    const fromStrengths = strengths.map((topic: any) => ({
      topic: this.capitalizeTopic(String(topic || 'general')),
      score: 80,
      attempts: 1,
      averageScore: 80,
      proficiency: 'Advanced',
      source: 'strength' as const,
      stars: 4,
    }));

    const fromWeaknesses = weaknesses
      .filter((w: any) => !strengths.includes(w))
      .map((topic: any) => ({
        topic: this.capitalizeTopic(String(topic || 'general')),
        score: 40,
        attempts: 1,
        averageScore: 40,
        proficiency: 'Learning',
        source: 'weakness' as const,
        stars: 2,
      }));

    const merged = [...fromStrengths, ...fromWeaknesses];
    if (merged.length > 0) {
      return merged;
    }

    return [
      {
        topic: 'General',
        score: Number(this.adaptiveProfile?.progress ?? 0),
        attempts: 0,
        averageScore: Number(this.adaptiveProfile?.progress ?? 0),
        proficiency: this.getSkillLevel(
          Number(this.adaptiveProfile?.progress ?? 0),
        ).level,
        source: 'neutral',
        stars: 1,
      },
    ];
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
        this.filteredSkills = this.skills.filter(
          (s) => s.source === 'strength',
        );
        break;
      case 'weaknesses':
        this.filteredSkills = this.skills.filter(
          (s) => s.source === 'weakness',
        );
        break;
      case 'in-progress':
        this.filteredSkills = this.skills.filter(
          (s) => s.proficiency === 'Learning' || s.proficiency === 'Beginner',
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
        return 'Strength';
      case 'weakness':
        return 'Weakness';
      default:
        return 'Neutral';
    }
  }

  getStarArray(count: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  getStarCountForLevel(level: string): number {
    return this.getStarCount(level);
  }
}
