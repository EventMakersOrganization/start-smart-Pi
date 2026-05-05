import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  HostListener,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { AdaptiveLearningService } from '../adaptive-learning.service';

Chart.register(...registerables);

@Component({
  selector: 'app-progress-charts',
  templateUrl: './progress-charts.component.html',
  styleUrls: ['./progress-charts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressChartsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() performances: any[] = [];
  @Input() adaptiveProfile: any = null;
  @Input() studentId: string | null = null;

  private charts: Chart[] = [];
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  trackingData: any = null;
  quizRankHistoryData: Array<{
    attemptIndex: number;
    quizId: string;
    quizTitle: string;
    rank: number;
    correctAnswersCount: number;
    totalQuestions: number;
    scorePercentage: number;
    classSize: number;
    submittedAt: string;
  }> = [];
  timeSpentByTopicData: Array<{ topic: string; minutes: number }> = [];

  constructor(
    private adaptiveService: AdaptiveLearningService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.refreshDerivedData();
    this.loadTracking();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentId']) {
      this.loadTracking();
      return;
    }

    if (changes['performances'] || changes['adaptiveProfile']) {
      this.refreshDerivedData();
      this.rebuildCharts();
    }
  }

  ngOnDestroy(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    this.destroyCharts();
  }

  destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private rebuildCharts(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }

    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null;
      this.destroyCharts();

      if (!this.hasAnalyticsData()) return;

      this.buildCharts();
      this.cdr.markForCheck();
    }, 220);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.hasAnalyticsData()) return;
    this.rebuildCharts();
  }

  private loadTracking(): void {
    if (!this.studentId) {
      this.trackingData = null;
      this.quizRankHistoryData = [];
      this.refreshDerivedData();
      this.rebuildCharts();
      this.cdr.markForCheck();
      return;
    }

    this.adaptiveService
      .getExerciseCompletionTracking(this.studentId)
      .subscribe({
        next: (data) => {
          this.trackingData = data;
          this.refreshDerivedData();
          this.rebuildCharts();
          this.cdr.markForCheck();
        },
        error: () => {
          this.trackingData = null;
          this.refreshDerivedData();
          this.rebuildCharts();
          this.cdr.markForCheck();
        },
      });

    this.adaptiveService.getStudentQuizRankHistory(this.studentId).subscribe({
      next: (data) => {
        this.quizRankHistoryData = Array.isArray(data?.points)
          ? data.points
          : [];
        this.rebuildCharts();
        this.cdr.markForCheck();
      },
      error: () => {
        this.quizRankHistoryData = [];
        this.rebuildCharts();
        this.cdr.markForCheck();
      },
    });
  }

  private refreshDerivedData(): void {
    this.timeSpentByTopicData = this.computeTimeSpentByTopic();
  }

  buildCharts(): void {
    // Ensure DOM is updated before building charts
    setTimeout(() => {
      const builders = [
        this.buildScoreLineChart,
        this.buildTopicBarChart,
        this.buildTimeSpentChart,
        this.buildQuizRankChart,
      ];

      builders.forEach((builder) => {
        try {
          builder.call(this);
        } catch (error) {
          console.error('Chart render error:', error);
        }
      });

      // Force Chart.js to recalculate layout
      this.cdr.markForCheck();
    }, 50);
  }

  // ── 1. Score Evolution (Line Chart) ──────────
  buildScoreLineChart(): void {
    const canvas = document.getElementById(
      'scoreLineChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const source = this.getRecentScorePoints();
    if (source.length === 0) return;

    // Add padding for visual balance with few data points
    const labels = source.map((p, i) =>
      p.topic ? `${p.topic}` : `Exercise ${i + 1}`,
    );
    const scores = source.map((p) => p.score);
    const sources = source.map((p) => p.source);
    const titles = source.map((p) => p.title);
    const topics = source.map((p) => p.topic);
    const dates = source.map((p) => p.date);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Score %',
            data: scores,
            borderColor: '#1152D4',
            backgroundColor: 'rgba(17, 82, 212, 0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: sources.map((s) =>
              s?.toLowerCase() === 'prosit' || s?.toLowerCase() === 'exercise'
                ? '#a855f7'
                : '#1152D4',
            ),
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              title: (tooltipItems: any) => {
                const index = tooltipItems[0].dataIndex;
                const src = sources[index]?.toLowerCase();
                const type =
                  src === 'prosit' || src === 'exercise' ? 'PROSIT' : 'QUIZ';
                return `${type}: ${titles[index]}`;
              },
              label: (ctx: any) => {
                const index = ctx.dataIndex;
                return [
                  ` Score: ${ctx.parsed.y}%`,
                  ` Subject: ${topics[index]}`,
                  ` Date: ${new Date(dates[index]).toLocaleDateString()}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val: any) => `${val}%`,
              stepSize: 20,
              padding: 8,
              font: { size: 11 },
            },
            grid: { color: 'rgba(0,0,0,0.05)', display: true },
          },
          x: {
            grid: { display: false },
            ticks: {
              padding: 8,
              font: { size: 11 },
            },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  // ── 2. Score par Topic (Bar Chart) ───────────
  buildTopicBarChart(): void {
    const canvas = document.getElementById(
      'topicBarChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const topicScores = this.getTopicAverageScores();
    const topics = topicScores.map((t) => t.topic);
    const averages = topicScores.map((t) => t.averageScore);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics.map((t) => this.shortenLabel(t)),
        datasets: [
          {
            label: 'Average Score',
            data: averages,
            backgroundColor: (ctx: any) => {
              const canvas = ctx.chart.ctx;
              const gradient = canvas.createLinearGradient(
                0,
                0,
                0,
                ctx.chart.height,
              );
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.85)'); // Blue
              gradient.addColorStop(1, 'rgba(16, 185, 129, 0.85)'); // Emerald
              return gradient;
            },
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 12,
            borderSkipped: false,
            maxBarThickness: 45,
            hoverBackgroundColor: '#10b981',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 14,
            cornerRadius: 12,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            displayColors: false,
            callbacks: {
              label: (ctx: any) => ` Mastery: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              padding: 10,
              font: { size: 12, weight: 600 },
              color: '#64748b',
            },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              font: { size: 10, weight: 600 },
              color: '#94a3b8',
              callback: (val: any) => `${val}%`,
            },
            grid: { color: 'rgba(0, 0, 0, 0.03)' },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  private shortenLabel(label: string): string {
    const maxLength = 15;
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength) + '...';
  }

  // ── 4. Time Spent by Topic (Bar Chart) ─────
  buildTimeSpentByTopicChart(): void {
    const canvas = document.getElementById(
      'timeSpentTopicChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const topicsData = this.getTimeSpentByTopic();
    const topTopics = topicsData.slice(0, 8);

    const topics = topTopics.map((item) => item.topic);
    const minutes = topTopics.map((item) => Math.round(item.minutes));

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics,
        datasets: [
          {
            label: 'Minutes',
            data: minutes,
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${ctx.parsed.x} min`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (val: any) => `${val} min`,
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  buildTimeSpentChart(): void {
    const canvas = document.getElementById(
      'timeSpentChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const topicsData = this.getTimeSpentByTopic();
    if (topicsData.length === 0) return;

    const topics = topicsData.map((item) => this.shortenLabel(item.topic));
    const minutes = topicsData.map((item) => item.minutes);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics,
        datasets: [
          {
            label: 'Minutes',
            data: minutes,
            backgroundColor: (ctx: any) => {
              const canvas = ctx.chart.ctx;
              const gradient = canvas.createLinearGradient(
                0,
                0,
                ctx.chart.width,
                0,
              );
              gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)'); // Indigo
              gradient.addColorStop(1, 'rgba(139, 92, 246, 0.85)'); // Violet
              return gradient;
            },
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 16,
            borderSkipped: false,
            minBarLength: 8,
            barPercentage: 0.6,
            categoryPercentage: 0.8,
            hoverBackgroundColor: '#8b5cf6',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 16,
            cornerRadius: 16,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            displayColors: false,
            callbacks: {
              label: (ctx: any) => {
                const value = Number(ctx.parsed.x || 0);
                const hours = Math.floor(value / 60);
                const mins = Math.round(value % 60);
                return hours > 0
                  ? ` ⏱️ Total: ${hours}h ${mins}min`
                  : ` ⏱️ Total: ${mins} minutes`;
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (val: any) => `${val}m`,
              font: { size: 11, weight: 600 },
              color: '#94a3b8',
            },
            grid: { color: 'rgba(0, 0, 0, 0.03)', display: true },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { weight: 700, size: 12 },
              color: '#475569',
              padding: 12,
            },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  // ── Helpers ───────────────────────────────────
  hasAnalyticsData(): boolean {
    if (this.trackingData?.summary?.totalAttempts > 0) return true;
    if (
      Array.isArray(this.trackingData?.byTopic) &&
      this.trackingData.byTopic.length > 0
    )
      return true;
    return this.performances.length > 0;
  }

  getAverageScore(): number {
    if (this.trackingData?.summary?.averageScore !== undefined) {
      return Math.round(Number(this.trackingData.summary.averageScore) || 0);
    }

    if (this.performances.length === 0) return 0;
    const total = this.performances.reduce((s, p) => s + p.score, 0);
    return Math.round(total / this.performances.length);
  }

  getBestScore(): number {
    if (
      Array.isArray(this.trackingData?.recentActivity) &&
      this.trackingData.recentActivity.length > 0
    ) {
      return Math.max(
        ...this.trackingData.recentActivity.map(
          (x: any) => Number(x.score) || 0,
        ),
      );
    }

    if (this.performances.length === 0) return 0;
    return Math.max(...this.performances.map((p) => p.score));
  }

  getTopTopic(): string {
    if (
      Array.isArray(this.trackingData?.byTopic) &&
      this.trackingData.byTopic.length > 0
    ) {
      const best = [...this.trackingData.byTopic].sort(
        (a: any, b: any) =>
          (Number(b.averageScore) || 0) - (Number(a.averageScore) || 0),
      )[0];
      return best?.topic || '—';
    }

    if (this.performances.length === 0) return '—';
    const topicMap: Record<
      string,
      {
        total: number;
        count: number;
      }
    > = {};
    this.performances.forEach((p) => {
      const t = p.topic || 'general';
      if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
      topicMap[t].total += p.score;
      topicMap[t].count++;
    });
    const best = Object.entries(topicMap).sort(
      ([, a], [, b]) => b.total / b.count - a.total / a.count,
    )[0];
    return best ? best[0] : '—';
  }

  getTrend(): string {
    if (
      Array.isArray(this.trackingData?.recentActivity) &&
      this.trackingData.recentActivity.length >= 2
    ) {
      const sorted = [...this.trackingData.recentActivity].sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const first3 = sorted.slice(0, 3);
      const last3 = sorted.slice(-3);
      const avgFirst =
        first3.reduce((s: number, p: any) => s + (Number(p.score) || 0), 0) /
        first3.length;
      const avgLast =
        last3.reduce((s: number, p: any) => s + (Number(p.score) || 0), 0) /
        last3.length;
      if (avgLast > avgFirst + 5) return 'up';
      if (avgLast < avgFirst - 5) return 'down';
      return 'neutral';
    }

    if (this.performances.length < 2) return 'neutral';
    const sorted = [...this.performances].sort(
      (a, b) =>
        new Date(a.attemptDate).getTime() - new Date(b.attemptDate).getTime(),
    );
    const last3 = sorted.slice(-3);
    const first3 = sorted.slice(0, 3);
    const avgLast = last3.reduce((s, p) => s + p.score, 0) / last3.length;
    const avgFirst = first3.reduce((s, p) => s + p.score, 0) / first3.length;
    if (avgLast > avgFirst + 5) return 'up';
    if (avgLast < avgFirst - 5) return 'down';
    return 'neutral';
  }

  getTotalStudyTime(): number {
    if (this.trackingData?.summary?.totalTimeSpent !== undefined) {
      return Number(this.trackingData.summary.totalTimeSpent) || 0;
    }

    return this.performances.reduce(
      (sum, p) => sum + (Number(p.timeSpent) || 0),
      0,
    );
  }

  formatDuration(minutes: number): string {
    if (minutes === 0) return '0 min';
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      return `${seconds} sec`;
    }
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  }

  getTopicTimePercentage(minutes: number): number {
    if (this.timeSpentByTopicData.length === 0) return 0;
    const maxMinutes = Math.max(
      ...this.timeSpentByTopicData.map((i) => i.minutes),
      1,
    );
    return (minutes / maxMinutes) * 100;
  }

  getTimeSpentByTopic(): Array<{ topic: string; minutes: number }> {
    return this.timeSpentByTopicData;
  }

  private computeTimeSpentByTopic(): Array<{ topic: string; minutes: number }> {
    if (Array.isArray(this.trackingData?.byTopic)) {
      return this.trackingData.byTopic
        .map((item: any) => ({
          topic: item.topic || 'general',
          minutes: Number(item.totalTimeSpent) || 0,
        }))
        .sort((a: any, b: any) => b.minutes - a.minutes);
    }

    const topicMap: Record<string, number> = {};
    this.performances.forEach((p) => {
      const topic = p.topic || 'general';
      const timeSpent = Number(p.timeSpent) || 0;
      topicMap[topic] = (topicMap[topic] || 0) + timeSpent;
    });

    return Object.entries(topicMap)
      .map(([topic, minutes]) => ({
        topic,
        minutes: minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  getMostStudiedTopic(): string {
    const topicsData = this.getTimeSpentByTopic();
    if (topicsData.length === 0) return '—';
    return topicsData[0].topic || '—';
  }

  getAverageTimePerTopic(): number {
    const topicsData = this.getTimeSpentByTopic();
    if (topicsData.length === 0) return 0;

    const total = topicsData.reduce(
      (sum, item) => sum + (Number(item.minutes) || 0),
      0,
    );
    return Math.round(total / topicsData.length);
  }

  private getRecentScorePoints(): Array<{
    topic: string;
    score: number;
    date: Date;
    title: string;
    source: string;
  }> {
    if (
      Array.isArray(this.trackingData?.recentActivity) &&
      this.trackingData.recentActivity.length > 0
    ) {
      return [...this.trackingData.recentActivity]
        .map((x: any) => ({
          topic: x.topic || 'general',
          score: Number(x.score) || 0,
          date: x.date,
          title: x.title || x.exerciseTitle || 'Assessment',
          source: x.source || 'exercise',
        }))
        .sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        )
        .slice(-10);
    }

    return [...this.performances]
      .map((x: any) => ({
        topic: x.topic || 'general',
        score: Number(x.score) || 0,
        date: x.attemptDate,
        title: x.title || x.exerciseTitle || 'Assessment',
        source: x.source || 'exercise',
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
  }

  getTopicAverageScores(): Array<{
    topic: string;
    averageScore: number;
  }> {
    if (
      Array.isArray(this.trackingData?.byTopic) &&
      this.trackingData.byTopic.length > 0
    ) {
      return this.trackingData.byTopic.map((x: any) => ({
        topic: x.topic || 'general',
        averageScore: Math.round(Number(x.averageScore) || 0),
      }));
    }

    const topicMap: Record<string, { total: number; count: number }> = {};
    this.performances.forEach((p) => {
      const t = p.topic || 'general';
      if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
      topicMap[t].total += Number(p.score) || 0;
      topicMap[t].count++;
    });

    return Object.keys(topicMap).map((topic) => ({
      topic,
      averageScore: Math.round(topicMap[topic].total / topicMap[topic].count),
    }));
  }

  // ════════════════════════════════════════════════════════
  // NEW CHARTS - RADAR, CUMULATIVE, HEATMAP
  // ════════════════════════════════════════════════════════

  // ── 6. Bump Chart: MCQ Quiz Rank in Class ──
  buildQuizRankChart(): void {
    const canvas = document.getElementById(
      'quizRankChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const points = Array.isArray(this.quizRankHistoryData)
      ? [...this.quizRankHistoryData].sort(
          (a, b) => Number(a.attemptIndex) - Number(b.attemptIndex),
        )
      : [];
    if (points.length === 0) return;

    const labels = points.map((point) =>
      this.shortenLabel(point.quizTitle || `Quiz #${point.attemptIndex}`),
    );
    const ranks = points.map((point) => Number(point.rank) || 1);
    const topRanks = points.map(() => 1);
    const classSizes = points.map((point) => Number(point.classSize) || 1);
    const maxClassSize = Math.max(...classSizes, 1);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Your Rank',
            data: ranks,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            fill: false,
            tension: 0.32,
          },
          {
            label: 'Top Rank',
            data: topRanks,
            borderColor: '#10b981',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
            borderDash: [4, 4],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 8,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 10, weight: 800 },
              padding: 20,
              color: '#475569',
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 16,
            cornerRadius: 16,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            displayColors: true,
            boxPadding: 6,
            callbacks: {
              title: (items: any) => {
                const idx = items?.[0]?.dataIndex ?? 0;
                return points[idx]?.quizTitle || `Quiz #${idx + 1}`;
              },
              label: (ctx: any) => {
                const idx = ctx.dataIndex;
                if (ctx.dataset.label === 'Your Rank') {
                  return ` Rank: #${ctx.parsed.y} / ${classSizes[idx]}`;
                }
                return ' Target: Top #1';
              },
              afterBody: (items: any) => {
                const idx = items?.[0]?.dataIndex ?? 0;
                return [
                  `Good answers: ${points[idx]?.correctAnswersCount || 0}/${points[idx]?.totalQuestions || 0}`,
                  `Score: ${Number(points[idx]?.scorePercentage || 0).toFixed(0)}%`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            min: 1,
            max: maxClassSize,
            reverse: true,
            ticks: {
              stepSize: 1,
              font: { size: 10, weight: 600 },
              color: '#94a3b8',
              callback: (val: any) => `#${val}`,
            },
            grid: { color: 'rgba(0, 0, 0, 0.03)' },
          },
          x: {
            ticks: {
              font: { size: 10, weight: 600 },
              color: '#64748b',
            },
            grid: { display: false },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  // ── 7. Activity Heatmap (Simulated) ──────────
  getHeatmapData(): Array<
    Array<{
      day: string;
      week: number;
      activityCount: number;
      quizCount: number;
      prositCount: number;
      otherCount: number;
      activityLabel: string;
      backgroundColor: string;
      textColor: string;
      borderColor: string;
      tooltip: string;
    }>
  > {
    // Grille 7 colonnes (jours de la semaine)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid: Array<
      Array<{
        day: string;
        week: number;
        activityCount: number;
        quizCount: number;
        prositCount: number;
        otherCount: number;
        activityLabel: string;
        backgroundColor: string;
        textColor: string;
        borderColor: string;
        tooltip: string;
      }>
    > = [];

    // Derniers 28 jours (4 semaines)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 27);

    const activityMap: Record<
      string,
      { quiz: number; prosit: number; other: number }
    > = {};
    this.performances.forEach((p) => {
      if (!p.attemptDate) return;
      const d = new Date(p.attemptDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(d.getDate()).padStart(2, '0')}`;

      if (!activityMap[key]) {
        activityMap[key] = { quiz: 0, prosit: 0, other: 0 };
      }

      const source = String(p.source || '').toLowerCase();
      if (source === 'quiz') {
        activityMap[key].quiz += 1;
      } else if (source === 'prosit') {
        activityMap[key].prosit += 1;
      } else {
        activityMap[key].other += 1;
      }
    });

    for (let i = 0; i < 28; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(d.getDate()).padStart(2, '0')}`;

      const dayOfWeek = d.getDay();
      const week = Math.floor(i / 7);
      const bucket = activityMap[key] || { quiz: 0, prosit: 0, other: 0 };
      const count = bucket.quiz + bucket.prosit + bucket.other;

      let backgroundColor: string;
      let textColor: string;
      let borderColor: string;
      if (count === 0) {
        backgroundColor = 'rgba(241, 245, 249, 1)';
        textColor = '#64748b';
        borderColor = 'rgba(226, 232, 240, 1)';
      } else if (count <= 1) {
        backgroundColor = 'rgba(186, 230, 253, 1)';
        textColor = '#0f172a';
        borderColor = 'rgba(125, 211, 252, 1)';
      } else if (count <= 3) {
        backgroundColor = 'rgba(74, 222, 128, 1)';
        textColor = '#052e16';
        borderColor = 'rgba(34, 197, 94, 1)';
      } else {
        backgroundColor = 'rgba(22, 163, 74, 1)';
        textColor = '#ffffff';
        borderColor = 'rgba(21, 128, 61, 1)';
      }

      if (!grid[week]) grid[week] = [];
      grid[week][dayOfWeek] = {
        day: days[dayOfWeek],
        week,
        activityCount: count,
        quizCount: bucket.quiz,
        prositCount: bucket.prosit,
        otherCount: bucket.other,
        activityLabel: this.getHeatmapActivityLabel(bucket.quiz, bucket.prosit),
        backgroundColor,
        textColor,
        borderColor,
        tooltip: this.formatHeatmapTooltip(key, bucket),
      };
    }

    return grid;
  }

  private getHeatmapActivityLabel(
    quizCount: number,
    prositCount: number,
  ): string {
    if (quizCount > 0 && prositCount > 0) return 'Quiz + Prosit';
    if (quizCount > 0) return 'Quiz';
    if (prositCount > 0) return 'Prosit';
    return '';
  }

  private formatHeatmapTooltip(
    dateKey: string,
    bucket: { quiz: number; prosit: number; other: number },
  ): string {
    const total = bucket.quiz + bucket.prosit + bucket.other;
    const pieces = [`${dateKey}: ${total} activit${total === 1 ? 'y' : 'ies'}`];
    if (bucket.quiz > 0) pieces.push(`Quiz: ${bucket.quiz}`);
    if (bucket.prosit > 0) pieces.push(`Prosit: ${bucket.prosit}`);
    if (bucket.other > 0) pieces.push(`Other: ${bucket.other}`);
    return pieces.join(' • ');
  }

  // ── 8. Completion Rate ───────────────────────
  getCompletionRate(): number {
    if (this.trackingData?.summary?.completionRate !== undefined) {
      return Math.round(Number(this.trackingData.summary.completionRate) || 0);
    }

    if (this.performances.length === 0) return 0;
    const passed = this.performances.filter((p) => p.score >= 70).length;
    return Math.round((passed / this.performances.length) * 100);
  }

  // ── 9. Total Exercises Attempted ─────────────
  getTotalExercisesAttempted(): number {
    if (this.trackingData?.summary?.totalAttempts !== undefined) {
      return Number(this.trackingData.summary.totalAttempts) || 0;
    }
    return this.performances.length;
  }

  // ── 10. Current Streak ──────────────────────
  getCurrentStreak(): number {
    if (this.trackingData?.summary?.currentStreak !== undefined) {
      return Number(this.trackingData.summary.currentStreak) || 0;
    }

    if (this.performances.length === 0) return 0;

    const uniqueDays = new Set<string>();
    this.performances.forEach((p) => {
      if (!p.attemptDate) return;
      const d = new Date(p.attemptDate);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(d.getDate()).padStart(2, '0')}`;
      uniqueDays.add(dayKey);
    });

    if (uniqueDays.size === 0) return 0;

    const sortedDaysDesc = Array.from(uniqueDays)
      .map((s) => new Date(`${s}T00:00:00.000Z`))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 1;
    for (let i = 1; i < sortedDaysDesc.length; i++) {
      const previous = sortedDaysDesc[i - 1].getTime();
      const current = sortedDaysDesc[i].getTime();
      const diffDays = Math.round((previous - current) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
