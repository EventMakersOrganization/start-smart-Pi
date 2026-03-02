import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-progress-charts',
  templateUrl: './progress-charts.component.html',
  styleUrls: ['./progress-charts.component.css']
})
export class ProgressChartsComponent implements OnInit, OnDestroy, OnChanges {

  @Input() performances: any[] = [];
  @Input() adaptiveProfile: any = null;

  private charts: Chart[] = [];

  ngOnInit(): void {
    setTimeout(() => this.buildCharts(), 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['performances'] || changes['adaptiveProfile']) {
      setTimeout(() => {
        this.destroyCharts();
        this.buildCharts();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  destroyCharts(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  buildCharts(): void {
    this.buildScoreLineChart();
    this.buildTopicBarChart();
    this.buildDifficultyDoughnut();
  }

  // ── 1. Score Evolution (Line Chart) ──────────
  buildScoreLineChart(): void {
    const canvas = document.getElementById(
      'scoreLineChart'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const sorted = [...this.performances]
      .sort((a, b) =>
        new Date(a.attemptDate).getTime() -
        new Date(b.attemptDate).getTime()
      )
      .slice(-10);

    const labels = sorted.map((p, i) =>
      p.topic ? `${p.topic} #${i + 1}` : `Exercise ${i + 1}`
    );
    const scores = sorted.map(p => p.score);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score',
          data: scores,
          borderColor: '#1152D4',
          backgroundColor: 'rgba(17, 82, 212, 0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1152D4',
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Score: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            ticks: {
              callback: val => `${val}%`,
              stepSize: 20
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false },
            ticks: { maxRotation: 30 }
          }
        }
      }
    });

    this.charts.push(chart);
  }

  // ── 2. Score par Topic (Bar Chart) ───────────
  buildTopicBarChart(): void {
    const canvas = document.getElementById(
      'topicBarChart'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    // Grouper par topic
    const topicMap: Record<string, {
      total: number; count: number
    }> = {};

    this.performances.forEach(p => {
      const t = p.topic || 'general';
      if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
      topicMap[t].total += p.score;
      topicMap[t].count++;
    });

    const topics = Object.keys(topicMap);
    const averages = topics.map(t =>
      Math.round(topicMap[t].total / topicMap[t].count)
    );

    const colors = topics.map(t => {
      const avg = Math.round(
        topicMap[t].total / topicMap[t].count
      );
      if (avg >= 75) return 'rgba(16, 185, 129, 0.8)';  // vert
      if (avg >= 50) return 'rgba(17, 82, 212, 0.8)';   // bleu
      return 'rgba(249, 115, 22, 0.8)';                  // orange
    });

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topics,
        datasets: [{
          label: 'Avg Score',
          data: averages,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Average: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            ticks: { callback: val => `${val}%` },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: { grid: { display: false } }
        }
      }
    });

    this.charts.push(chart);
  }

  // ── 3. Difficulty Distribution (Doughnut) ────
  buildDifficultyDoughnut(): void {
    const canvas = document.getElementById(
      'difficultyDoughnut'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    this.performances.forEach(p => {
      const d = p.difficulty || 'beginner';
      if (d in counts) counts[d as keyof typeof counts]++;
    });

    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Beginner', 'Intermediate', 'Advanced'],
        datasets: [{
          data: [
            counts.beginner,
            counts.intermediate,
            counts.advanced
          ],
          backgroundColor: [
            'rgba(249, 115, 22, 0.8)',
            'rgba(17, 82, 212, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, font: { size: 12 } }
          }
        }
      }
    });

    this.charts.push(chart);
  }

  // ── Helpers ───────────────────────────────────
  getAverageScore(): number {
    if (this.performances.length === 0) return 0;
    const total = this.performances.reduce(
      (s, p) => s + p.score, 0
    );
    return Math.round(total / this.performances.length);
  }

  getBestScore(): number {
    if (this.performances.length === 0) return 0;
    return Math.max(...this.performances.map(p => p.score));
  }

  getTopTopic(): string {
    if (this.performances.length === 0) return '—';
    const topicMap: Record<string, {
      total: number; count: number
    }> = {};
    this.performances.forEach(p => {
      const t = p.topic || 'general';
      if (!topicMap[t]) topicMap[t] = { total: 0, count: 0 };
      topicMap[t].total += p.score;
      topicMap[t].count++;
    });
    const best = Object.entries(topicMap)
      .sort(([, a], [, b]) =>
        (b.total / b.count) - (a.total / a.count)
      )[0];
    return best ? best[0] : '—';
  }

  getTrend(): string {
    if (this.performances.length < 2) return 'neutral';
    const sorted = [...this.performances].sort(
      (a, b) =>
        new Date(a.attemptDate).getTime() -
        new Date(b.attemptDate).getTime()
    );
    const last3 = sorted.slice(-3);
    const first3 = sorted.slice(0, 3);
    const avgLast = last3.reduce(
      (s, p) => s + p.score, 0
    ) / last3.length;
    const avgFirst = first3.reduce(
      (s, p) => s + p.score, 0
    ) / first3.length;
    if (avgLast > avgFirst + 5) return 'up';
    if (avgLast < avgFirst - 5) return 'down';
    return 'neutral';
  }
}