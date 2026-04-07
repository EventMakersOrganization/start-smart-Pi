import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { RiskDistributionData } from '../../services/analytics.service';

Chart.register(...registerables);

@Component({
  selector: 'app-risk-chart',
  templateUrl: './risk-chart.component.html',
  styleUrls: ['./risk-chart.component.css'],
})
export class RiskChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: RiskDistributionData | null = null;
  @ViewChild('riskCanvas') riskCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.riskCanvas) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.riskCanvas?.nativeElement || !this.data) {
      return;
    }

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Low', 'Medium', 'High'],
        datasets: [
          {
            label: 'Risk Distribution',
            data: [this.data.low, this.data.medium, this.data.high],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
        },
      },
    };

    this.chart?.destroy();
    this.chart = new Chart(this.riskCanvas.nativeElement, config);
  }
}
