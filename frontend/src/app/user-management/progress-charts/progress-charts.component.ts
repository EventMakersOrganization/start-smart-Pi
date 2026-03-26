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
    }, 150);
  }

  private loadTracking(): void {
    if (!this.studentId) {
      this.trackingData = null;
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
  }

  private refreshDerivedData(): void {
    this.timeSpentByTopicData = this.computeTimeSpentByTopic();
  }

  buildCharts(): void {
    const builders = [
      this.buildScoreLineChart,
      this.buildTopicBarChart,
      this.buildDifficultyDoughnut,
      this.buildTimeSpentChart,
      this.buildRadarChart,
      this.buildCumulativeLineChart,
    ];

    builders.forEach((builder) => {
      try {
        builder.call(this);
      } catch (error) {
        console.error('Chart render error:', error);
      }
    });
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
    const labels = source.map((p, i) =>
      p.topic ? `${p.topic} #${i + 1}` : `Exercise ${i + 1}`,
    );
    const scores = source.map((p) => p.score);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Score',
            data: scores,
            borderColor: '#1152D4',
            backgroundColor: 'rgba(17, 82, 212, 0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#1152D4',
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Score: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`,
              stepSize: 20,
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            grid: { display: false },
            ticks: { maxRotation: 30 },
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

    const colors = topics.map((t) => {
      const avg = topicScores.find((x) => x.topic === t)?.averageScore || 0;
      if (avg >= 75) return 'rgba(16, 185, 129, 0.8)'; // vert
      if (avg >= 50) return 'rgba(17, 82, 212, 0.8)'; // bleu
      return 'rgba(249, 115, 22, 0.8)'; // orange
    });

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics,
        datasets: [
          {
            label: 'Avg Score',
            data: averages,
            backgroundColor: colors,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Average: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: (val) => `${val}%` },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });

    this.charts.push(chart);
  }

  // ── 3. Difficulty Distribution (Doughnut) ────
  buildDifficultyDoughnut(): void {
    const canvas = document.getElementById(
      'difficultyDoughnut',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const counts = this.getDifficultyCounts();

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Beginner', 'Intermediate', 'Advanced'],
        datasets: [
          {
            data: [counts.beginner, counts.intermediate, counts.advanced],
            backgroundColor: [
              'rgba(249, 115, 22, 0.8)',
              'rgba(17, 82, 212, 0.8)',
              'rgba(16, 185, 129, 0.8)',
            ],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, font: { size: 12 } },
          },
        },
      },
    });

    this.charts.push(chart);
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
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x} min`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (val) => `${val} min`,
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

    const topics = topicsData.map((item) => item.topic);
    const minutes = topicsData.map((item) => Math.round(item.minutes));

    const maxIndex = Math.max(topicsData.length - 1, 1);
    const barColors = topicsData.map((_, index) => {
      const alpha = 0.95 - (index / maxIndex) * 0.6;
      return `rgba(17, 82, 212, ${Math.max(alpha, 0.35).toFixed(2)})`;
    });

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics,
        datasets: [
          {
            label: 'Minutes',
            data: minutes,
            backgroundColor: barColors,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Time Spent per Topic',
            font: { size: 14, weight: 'bold' },
            padding: { bottom: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const topic = String(ctx.label || 'topic');
                const value = Number(ctx.parsed.x || 0);
                return `${value} minutes spent on ${topic}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Minutes',
            },
            ticks: {
              callback: (val) => `${val} min`,
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
        minutes: Math.round(minutes),
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

  private getDifficultyCounts(): {
    beginner: number;
    intermediate: number;
    advanced: number;
  } {
    if (this.trackingData?.byDifficulty) {
      return {
        beginner:
          Number(this.trackingData.byDifficulty.beginner?.attempts) || 0,
        intermediate:
          Number(this.trackingData.byDifficulty.intermediate?.attempts) || 0,
        advanced:
          Number(this.trackingData.byDifficulty.advanced?.attempts) || 0,
      };
    }

    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    this.performances.forEach((p) => {
      const d = p.difficulty || 'beginner';
      if (d in counts) counts[d as keyof typeof counts]++;
    });
    return counts;
  }

  // ════════════════════════════════════════════════════════
  // NEW CHARTS - RADAR, CUMULATIVE, HEATMAP
  // ════════════════════════════════════════════════════════

  // ── 5. Radar Chart (Spider Chart) ────────────
  buildRadarChart(): void {
    const canvas = document.getElementById('radarChart') as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const topicScores = this.getTopicAverageScores();
    if (topicScores.length === 0) return;

    const topics = topicScores.map((t) => t.topic);
    const scores = topicScores.map((t) => t.averageScore);

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: topics,
        datasets: [
          {
            label: 'Average Score',
            data: scores,
            borderColor: 'rgba(17, 82, 212, 0.8)',
            backgroundColor: 'rgba(17, 82, 212, 0.15)',
            borderWidth: 2.5,
            pointRadius: 5,
            pointBackgroundColor: 'rgba(17, 82, 212, 1)',
            pointHoverRadius: 7,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 12 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.r}%`,
            },
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: (val) => `${val}%`,
              font: { size: 10 },
            },
            grid: { color: 'rgba(0, 0, 0, 0.08)' },
            pointLabels: {
              font: { size: 12, weight: 'bold' },
            },
          },
        },
      },
    });

    this.charts.push(chart);
  }

  // ── 6. Cumulative Line Chart with Moving Average ──
  buildCumulativeLineChart(): void {
    const canvas = document.getElementById(
      'cumulativeLineChart',
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    const points = this.getRecentScorePoints();
    if (points.length === 0) return;

    const labels = points.map((_, i) => `#${i + 1}`);
    const scores = points.map((p) => p.score);

    // Calculate cumulative average
    const cumulativeAvg: number[] = [];
    let cumulative = 0;
    scores.forEach((score, index) => {
      cumulative += score;
      cumulativeAvg.push(Math.round((cumulative / (index + 1)) * 100) / 100);
    });

    // Calculate 3-point moving average
    const movingAvg3: (number | null)[] = scores.map((_, index) => {
      if (index < 2) return null;
      const window = scores.slice(index - 2, index + 1);
      return (
        Math.round((window.reduce((s, v) => s + v, 0) / window.length) * 100) /
        100
      );
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Exercise Score',
            data: scores,
            borderColor: 'rgba(17, 82, 212, 0.6)',
            backgroundColor: 'rgba(17, 82, 212, 0.05)',
            borderWidth: 1.5,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(17, 82, 212, 0.8)',
            fill: false,
            tension: 0.2,
            yAxisID: 'y',
          },
          {
            label: 'Cumulative Average',
            data: cumulativeAvg,
            borderColor: 'rgba(16, 185, 129, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(16, 185, 129, 1)',
            fill: false,
            tension: 0.3,
            yAxisID: 'y',
          },
          {
            label: '3-Point Moving Avg',
            data: movingAvg3,
            borderColor: 'rgba(249, 115, 22, 0.8)',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            borderDash: [5, 5],
            pointRadius: 4,
            pointBackgroundColor: 'rgba(249, 115, 22, 1)',
            fill: false,
            tension: 0.3,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: { padding: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const datasetLabel = ctx.dataset.label || '';
                const yValue = ctx.parsed.y ?? 0;
                return ` ${datasetLabel}: ${yValue.toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`,
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
          },
          x: {
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
      backgroundColor: string;
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
        backgroundColor: string;
        tooltip: string;
      }>
    > = [];

    // Derniers 28 jours (4 semaines)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 27);

    const activityMap: Record<string, number> = {};
    this.performances.forEach((p) => {
      if (!p.attemptDate) return;
      const d = new Date(p.attemptDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(d.getDate()).padStart(2, '0')}`;
      activityMap[key] = (activityMap[key] || 0) + 1;
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
      const count = activityMap[key] || 0;

      let backgroundColor: string;
      if (count === 0) {
        backgroundColor = 'rgba(226, 232, 240, 0.6)'; // light gray
      } else if (count <= 1) {
        backgroundColor = 'rgba(100, 200, 150, 0.6)'; // light green
      } else if (count <= 3) {
        backgroundColor = 'rgba(50, 180, 100, 0.8)'; // medium green
      } else {
        backgroundColor = 'rgba(16, 150, 80, 1)'; // dark green
      }

      if (!grid[week]) grid[week] = [];
      grid[week][dayOfWeek] = {
        day: days[dayOfWeek],
        week,
        activityCount: count,
        backgroundColor,
        tooltip: `${key}: ${count} exercise${count !== 1 ? 's' : ''}`,
      };
    }

    return grid;
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
