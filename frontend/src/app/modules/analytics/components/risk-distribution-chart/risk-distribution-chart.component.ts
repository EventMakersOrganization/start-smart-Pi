import { Component, Input, OnInit } from '@angular/core';

export interface RiskDistributionData {
  low: number;
  medium: number;
  high: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  total: number;
}

@Component({
  selector: 'app-risk-distribution-chart',
  templateUrl: './risk-distribution-chart.component.html',
  styleUrls: ['./risk-distribution-chart.component.css']
})
export class RiskDistributionChartComponent implements OnInit {
  @Input() data: RiskDistributionData = {
    low: 0,
    medium: 0,
    high: 0,
    lowPercentage: 0,
    mediumPercentage: 0,
    highPercentage: 0,
    total: 0
  };

  ngOnInit(): void {
    // Data is provided via @Input
  }

  /**
   * Calculate bar height based on percentage
   */
  getBarHeight(value: number): string {
    if (this.data.total === 0) return '0%';
    const percentage = (value / this.data.total) * 100;
    return `${percentage}%`;
  }
}
