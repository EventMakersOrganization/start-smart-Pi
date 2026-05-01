import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

Chart.register(...registerables);

interface StudentMetrics {
  studentId: string;
  averageScore: number;
  completionRate: number;
  totalTimeSpent: number;
  streak: number;
  topicScores: Record<string, number>;
}

interface ClassComparison {
  myMetrics: StudentMetrics;
  classAverage: StudentMetrics;
  rankingPercentile: number;
  totalStudents: number;
  topicsToCompare: string[];
}

@Component({
  selector: 'app-peer-comparison',
  templateUrl: './peer-comparison.component.html',
  styleUrls: ['./peer-comparison.component.css'],
})
export class PeerComparisonComponent implements OnInit, OnDestroy, OnChanges {
  @Input() studentId: string = '';
  @Input() adaptiveProfile: any = {};

  @ViewChild('barChartCanvas', { static: false })
  barChartCanvas: ElementRef | null = null;

  @ViewChild('radarChartCanvas', { static: false })
  radarChartCanvas: ElementRef | null = null;

  private destroy$ = new Subject<void>();
  private barChart: Chart | null = null;
  private radarChart: Chart | null = null;

  comparisonData: ClassComparison | null = null;
  loading = true;
  error: string | null = null;

  // Comparison metrics display
  scoreComparison = { mine: 0, class: 0, difference: 0 };
  completionComparison = { mine: 0, class: 0, difference: 0 };
  timeComparison = { mine: 0, class: 0, difference: 0 };
  streakComparison = { mine: 0, class: 0, difference: 0 };

  rankingMessage = '';
  formattedRankingPercentile = '0%';

  constructor(private adaptiveLearningService: AdaptiveLearningService) {}

  ngOnInit(): void {
    if (this.studentId) {
      this.loadPeerComparison();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId'] && changes['studentId'].currentValue) {
      this.loadPeerComparison();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.barChart) {
      this.barChart.destroy();
    }
    if (this.radarChart) {
      this.radarChart.destroy();
    }
  }

  private loadPeerComparison(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      myTracking: this.adaptiveLearningService
        .getExerciseCompletionTracking(this.studentId)
        .pipe(
          catchError(() =>
            of({
              summary: {
                averageScore: 0,
                completionRate: 0,
                totalTimeSpent: 0,
                currentStreak: 0,
              },
              byTopic: [],
            }),
          ),
        ),
      comparisonApi: this.adaptiveLearningService
        .getStudentComparisonAnalytics(this.studentId)
        .pipe(catchError(() => of(null))),
      allProfiles: this.adaptiveLearningService
        .getAllProfiles()
        .pipe(catchError(() => of([]))),
      allPerformances: this.adaptiveLearningService
        .getAllPerformances()
        .pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ myTracking, comparisonApi, allProfiles, allPerformances }) => {
          this.calculateComparison(
            myTracking,
            comparisonApi,
            allProfiles || [],
            allPerformances || [],
          );
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading peer comparison data:', err);
          this.error = 'Unable to load peer comparison data.';
          this.loading = false;
        },
      });
  }

  private calculateComparison(
    myTracking: any,
    comparisonApi: any,
    allProfiles: any[],
    allPerformances: any[],
  ): void {
    // Build my metrics
    const myMetrics = this.buildStudentMetrics(this.studentId, myTracking);

    if (comparisonApi && typeof comparisonApi === 'object') {
      const apiStudent = comparisonApi?.student || {};
      const apiClass = comparisonApi?.classAverage || {};
      const topicScores: Record<string, number> = {};
      (myTracking?.byTopic || []).forEach((topic: any) => {
        const name = String(topic?.topic || '').trim();
        if (!name) return;
        topicScores[name] = Number(topic?.averageScore || 0);
      });

      const myFromApi: StudentMetrics = {
        studentId: this.studentId,
        averageScore: Number(apiStudent?.averageScore ?? myMetrics.averageScore ?? 0),
        completionRate: Number(apiStudent?.completionRate ?? myMetrics.completionRate ?? 0),
        totalTimeSpent: Number(apiStudent?.totalTimeSpent ?? myMetrics.totalTimeSpent ?? 0),
        streak: Number(apiStudent?.streak ?? myMetrics.streak ?? 0),
        topicScores,
      };

      const classFromApi: StudentMetrics = {
        studentId: 'class-average',
        averageScore: Number(apiClass?.averageScore ?? 0),
        completionRate: Number(apiClass?.completionRate ?? 0),
        totalTimeSpent: Number(apiClass?.totalTimeSpent ?? 0),
        streak: Number(apiClass?.streak ?? 0),
        topicScores: Object.keys(topicScores).reduce((acc, key) => {
          acc[key] = Number(apiClass?.averageScore ?? 0);
          return acc;
        }, {} as Record<string, number>),
      };

      this.comparisonData = {
        myMetrics: myFromApi,
        classAverage: classFromApi,
        rankingPercentile: Number(comparisonApi?.rankingPercentile ?? 0),
        totalStudents: Math.max(1, Number(comparisonApi?.totalStudents ?? 0)),
        topicsToCompare: Object.keys(topicScores),
      };

      this.updateComparisons();
      this.initCharts();
      return;
    }

    // Build class metrics (from all other students or mock data)
    const allStudents = this.buildAllStudentMetrics(
      allProfiles,
      allPerformances,
    );
    const classMetrics = this.calculateClassAverage(allStudents);

    // Calculate ranking percentile
    const betterOrEqualCount = allStudents.filter(
      (s) => s.averageScore >= myMetrics.averageScore,
    ).length;
    const rankingPercentile =
      allStudents.length > 0
        ? Math.round(
            ((allStudents.length - betterOrEqualCount + 1) /
              allStudents.length) *
              100,
          )
        : 0;

    // Build comparison object
    const allTopics = Array.from(
      new Set([
        ...Object.keys(myMetrics.topicScores),
        ...Object.keys(classMetrics.topicScores),
      ]),
    );

    this.comparisonData = {
      myMetrics,
      classAverage: classMetrics,
      rankingPercentile,
      totalStudents: allStudents.length,
      topicsToCompare: allTopics,
    };

    this.updateComparisons();
    this.initCharts();
  }

  private buildStudentMetrics(
    studentId: string,
    tracking: any,
  ): StudentMetrics {
    const summary = tracking.summary || {};
    const byTopic = tracking.byTopic || [];

    const topicScores: Record<string, number> = {};
    byTopic.forEach((topic: any) => {
      topicScores[topic.topic] = topic.averageScore || 0;
    });

    return {
      studentId,
      averageScore: Math.round(summary.averageScore * 100) / 100,
      completionRate: summary.completionRate || 0,
      totalTimeSpent: summary.totalTimeSpent || 0,
      streak: summary.currentStreak || 0,
      topicScores,
    };
  }

  private buildAllStudentMetrics(
    allProfiles: any[],
    allPerformances: any[],
  ): StudentMetrics[] {
    const profiles = Array.isArray(allProfiles) ? allProfiles : [];
    const performances = Array.isArray(allPerformances) ? allPerformances : [];

    const performancesByStudent = new Map<string, any[]>();
    performances.forEach((performance: any) => {
      const studentId = String(
        performance?.studentId || performance?.userId || '',
      ).trim();
      if (!studentId) return;

      if (!performancesByStudent.has(studentId)) {
        performancesByStudent.set(studentId, []);
      }
      performancesByStudent.get(studentId)!.push(performance);
    });

    const metricsByStudent = new Map<string, StudentMetrics>();

    profiles.forEach((profile: any) => {
      const studentId = String(profile?.userId || profile?._id || '').trim();
      if (!studentId) return;

      const studentPerformances = performancesByStudent.get(studentId) || [];
      metricsByStudent.set(
        studentId,
        this.profileToMetrics(profile, studentPerformances),
      );
      performancesByStudent.delete(studentId);
    });

    performancesByStudent.forEach((studentPerformances, studentId) => {
      metricsByStudent.set(
        studentId,
        this.profileToMetrics(null, studentPerformances, studentId),
      );
    });

    return Array.from(metricsByStudent.values());
  }

  private profileToMetrics(
    profile: any,
    performances: any[] = [],
    fallbackStudentId = '',
  ): StudentMetrics {
    if (performances.length > 0) {
      return this.performancesToMetrics(
        fallbackStudentId || String(profile?._id || profile?.userId || ''),
        performances,
      );
    }

    const baseScore = this.normalizeScore(
      profile?.progress ?? profile?.averageScore ?? 0,
    );
    const topicScores: Record<string, number> = {};

    if (profile?.strengths) {
      profile.strengths.forEach((topic: string) => {
        topicScores[topic] = 85;
      });
    }

    if (profile?.weaknesses) {
      profile.weaknesses.forEach((topic: string) => {
        topicScores[topic] = 45;
      });
    }

    return {
      studentId: String(
        profile?._id || profile?.userId || fallbackStudentId || 'unknown',
      ),
      averageScore: baseScore,
      completionRate: baseScore,
      totalTimeSpent: Math.round((baseScore / 100) * 7200),
      streak: Number(profile?.streak || profile?.currentStreak || 0),
      topicScores,
    };
  }

  private performancesToMetrics(
    studentId: string,
    performances: any[],
  ): StudentMetrics {
    const normalizedPerformances = performances || [];
    const scores = normalizedPerformances
      .map((performance: any) => Number(performance?.score) || 0)
      .filter((score: number) => Number.isFinite(score));

    const averageScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((sum: number, score: number) => sum + score, 0) /
              scores.length) *
              100,
          ) / 100
        : 0;

    const completionRate =
      scores.length > 0
        ? Math.round(
            (scores.filter((score: number) => score >= 70).length /
              scores.length) *
              10000,
          ) / 100
        : 0;

    const totalTimeSpent = Math.round(
      normalizedPerformances.reduce(
        (sum: number, performance: any) =>
          sum + (Number(performance?.timeSpent) || 0),
        0,
      ),
    );

    const topicScores: Record<string, number> = {};
    const topicBuckets = new Map<string, { total: number; count: number }>();

    normalizedPerformances.forEach((performance: any) => {
      const topic = String(performance?.topic || 'general').trim();
      if (!topic) return;

      if (!topicBuckets.has(topic)) {
        topicBuckets.set(topic, { total: 0, count: 0 });
      }

      const bucket = topicBuckets.get(topic)!;
      bucket.total += Number(performance?.score) || 0;
      bucket.count += 1;
    });

    topicBuckets.forEach((bucket, topic) => {
      topicScores[topic] =
        Math.round((bucket.total / bucket.count) * 100) / 100;
    });

    return {
      studentId,
      averageScore,
      completionRate,
      totalTimeSpent,
      streak: this.calculateStreakFromPerformances(normalizedPerformances),
      topicScores,
    };
  }

  private calculateStreakFromPerformances(performances: any[]): number {
    if (!performances || performances.length === 0) {
      return 0;
    }

    const dates = performances
      .map((performance: any) =>
        new Date(
          performance?.attemptDate || performance?.createdAt || new Date(),
        ).toDateString(),
      )
      .filter((date) => date && date !== 'Invalid Date');

    const uniqueDates = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    if (uniqueDates.length === 0) {
      return 0;
    }

    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const diff =
        (new Date(uniqueDates[i]).getTime() -
          new Date(uniqueDates[i + 1]).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private normalizeScore(value: unknown): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numericValue)));
  }

  private calculateClassAverage(allStudents: StudentMetrics[]): StudentMetrics {
    if (allStudents.length === 0) {
      return {
        studentId: 'class-average',
        averageScore: 0,
        completionRate: 0,
        totalTimeSpent: 0,
        streak: 0,
        topicScores: {},
      };
    }

    const avgScore =
      Math.round(
        (allStudents.reduce((sum, s) => sum + s.averageScore, 0) /
          allStudents.length) *
          100,
      ) / 100;

    const avgCompletion =
      allStudents.reduce((sum, s) => sum + s.completionRate, 0) /
      allStudents.length;

    const avgTimeSpent = Math.round(
      allStudents.reduce((sum, s) => sum + s.totalTimeSpent, 0) /
        allStudents.length,
    );

    const avgStreak =
      Math.round(
        (allStudents.reduce((sum, s) => sum + s.streak, 0) /
          allStudents.length) *
          100,
      ) / 100;

    // Calculate average scores per topic
    const allTopics = new Set<string>();
    allStudents.forEach((s) => {
      Object.keys(s.topicScores).forEach((topic) => allTopics.add(topic));
    });

    const topicScores: Record<string, number> = {};
    allTopics.forEach((topic) => {
      const topicScoresArray = allStudents
        .map((s) => s.topicScores[topic])
        .filter((score) => score !== undefined);
      if (topicScoresArray.length > 0) {
        topicScores[topic] =
          Math.round(
            (topicScoresArray.reduce((sum, s) => sum + s, 0) /
              topicScoresArray.length) *
              100,
          ) / 100;
      }
    });

    return {
      studentId: 'class-average',
      averageScore: avgScore,
      completionRate: Math.round(avgCompletion * 100) / 100,
      totalTimeSpent: avgTimeSpent,
      streak: avgStreak,
      topicScores,
    };
  }

  private updateComparisons(): void {
    if (!this.comparisonData) return;

    const { myMetrics, classAverage, rankingPercentile } = this.comparisonData;

    this.scoreComparison = {
      mine: myMetrics.averageScore,
      class: classAverage.averageScore,
      difference:
        Math.round((myMetrics.averageScore - classAverage.averageScore) * 100) /
        100,
    };

    this.completionComparison = {
      mine: Math.round(myMetrics.completionRate * 100) / 100,
      class: Math.round(classAverage.completionRate * 100) / 100,
      difference:
        Math.round(
          (myMetrics.completionRate - classAverage.completionRate) * 100,
        ) / 100,
    };

    this.timeComparison = {
      mine: Math.round(myMetrics.totalTimeSpent / 60),
      class: Math.round(classAverage.totalTimeSpent / 60),
      difference: Math.round(
        (myMetrics.totalTimeSpent - classAverage.totalTimeSpent) / 60,
      ),
    };

    this.streakComparison = {
      mine: myMetrics.streak,
      class: Math.round(classAverage.streak * 100) / 100,
      difference:
        Math.round((myMetrics.streak - classAverage.streak) * 100) / 100,
    };

    this.formattedRankingPercentile = `${rankingPercentile}%`;
    this.rankingMessage = `You are in the top ${rankingPercentile}% of students`;
  }

  private initCharts(): void {
    if (!this.comparisonData) return;

    // Allow DOM to render before chart initialization
    setTimeout(() => {
      this.initBarChart();
      this.initRadarChart();
    }, 150);
  }

  private initBarChart(): void {
    if (!this.barChartCanvas) return;

    const { myMetrics, classAverage, topicsToCompare } = this.comparisonData!;

    const myScores = topicsToCompare.map(
      (topic) => myMetrics.topicScores[topic] || 0,
    );
    const classScores = topicsToCompare.map(
      (topic) => classAverage.topicScores[topic] || 0,
    );

    const ctx = this.barChartCanvas.nativeElement.getContext('2d');

    if (this.barChart) {
      this.barChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: topicsToCompare,
        datasets: [
          {
            label: 'My Score',
            data: myScores,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Class Average',
            data: classScores,
            backgroundColor: 'rgba(107, 114, 128, 0.6)',
            borderColor: 'rgba(107, 114, 128, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { size: 12 },
              padding: 15,
            },
          },
          title: {
            display: true,
            text: 'Performance by Topic',
            font: { size: 14, weight: 'bold' },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: { size: 11 },
            },
          },
          x: {
            ticks: {
              font: { size: 11 },
            },
          },
        },
      } as any,
    };

    this.barChart = new Chart(ctx, config);
  }

  private initRadarChart(): void {
    if (!this.radarChartCanvas) return;

    const { myMetrics, classAverage, topicsToCompare } = this.comparisonData!;

    const myScores = topicsToCompare.map(
      (topic) => myMetrics.topicScores[topic] || 0,
    );
    const classScores = topicsToCompare.map(
      (topic) => classAverage.topicScores[topic] || 0,
    );

    const ctx = this.radarChartCanvas.nativeElement.getContext('2d');

    if (this.radarChart) {
      this.radarChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'radar',
      data: {
        labels: topicsToCompare,
        datasets: [
          {
            label: 'My Skills',
            data: myScores,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
          {
            label: 'Class Average',
            data: classScores,
            borderColor: 'rgba(107, 114, 128, 1)',
            backgroundColor: 'rgba(107, 114, 128, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(107, 114, 128, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { size: 12 },
              padding: 15,
            },
          },
          title: {
            display: true,
            text: 'Skills Comparison',
            font: { size: 14, weight: 'bold' },
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: { size: 10 },
              stepSize: 20,
            },
          },
        },
      } as any,
    };

    this.radarChart = new Chart(ctx, config);
  }

  getComparisonColor(difference: number): string {
    if (difference > 0) return 'text-green-600';
    if (difference < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  getComparisonBadgeColor(difference: number): string {
    if (difference > 0) return 'bg-green-100 text-green-800';
    if (difference < 0) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

  getComparisonIcon(difference: number): string {
    if (difference > 0) return '↑';
    if (difference < 0) return '↓';
    return '→';
  }
}
