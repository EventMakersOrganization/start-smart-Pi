import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandLogoComponent } from '../../../shared/brand-logo/brand-logo.component';
import { StatsService } from '../../services/stats.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
    selector: 'app-solo-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, BrandLogoComponent],
    templateUrl: './solo-dashboard.component.html',
    styles: [`
    .stat-card {
      @apply bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 transition-all duration-300 hover:bg-white/15;
    }
  `]
})
export class SoloDashboardComponent implements OnInit {
    stats: any = null;
    loading = true;
    error = false;

    constructor(private statsService: StatsService) { }

    ngOnInit(): void {
        this.loadStats();
    }

    loadStats() {
        this.loading = true;
        this.statsService.getSoloStats()
            .pipe(
                catchError(err => {
                    console.error('Stats error:', err);
                    this.error = true;
                    return of(null);
                }),
                finalize(() => this.loading = false)
            )
            .subscribe(res => {
                if (res) this.stats = res;
            });
    }

    // Helper for SVG path generation (Line Chart)
    getLinePath(data: any[]): string {
        if (!data || data.length < 2) return '';
        const maxScore = Math.max(...data.map(d => d.score), 100);
        const width = 1000;
        const height = 400;
        const step = width / (data.length - 1);

        return data.map((d, i) => {
            const x = i * step;
            const y = height - (d.score / maxScore) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }

    // Helper for Donut Chart segments
    getDonutSegments(data: any[]): any[] {
        if (!data || data.length === 0) return [];
        const total = data.reduce((acc, curr) => acc + curr.count, 0);
        let cumulative = 0;
        return data.map((d, i) => {
            const percentage = (d.count / total) * 100;
            const start = cumulative;
            cumulative += percentage;
            return {
                name: d._id,
                percentage,
                offset: start,
                color: this.getColor(i)
            };
        });
    }

    getColor(index: number): string {
        const colors = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#3b82f6'];
        return colors[index % colors.length];
    }
}
