import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-alerts-chart',
  templateUrl: './alerts-chart.component.html',
  styleUrls: ['./alerts-chart.component.css'],
})
export class AlertsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() labels: string[] = [];
  @Input() values: number[] = [];
  @ViewChild('alertsCanvas') alertsCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['labels'] || changes['values']) && this.alertsCanvas) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.alertsCanvas?.nativeElement) {
      return;
    }

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: this.labels,
        datasets: [
          {
            label: 'Alerts',
            data: this.values,
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    };

    this.chart?.destroy();
    this.chart = new Chart(this.alertsCanvas.nativeElement, config);
  }
}
