import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.css']
})
export class KpiCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = 0;
  @Input() icon: string = '';
  @Input() trend: string = '';
  @Input() trendDirection: 'up' | 'down' = 'up';
  @Input() bgColor: string = 'bg-blue-100 dark:bg-blue-900/40';
  @Input() iconColor: string = 'text-blue-600';

  get trendClass(): string {
    const colors = {
      up: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
      down: 'text-red-600 bg-red-100 dark:bg-red-900/30'
    };
    return `flex items-center text-xs font-bold ${colors[this.trendDirection]} px-2 py-1 rounded-full`;
  }

  get trendIcon(): string {
    return this.trendDirection === 'up' ? 'trending_up' : 'trending_down';
  }
}
