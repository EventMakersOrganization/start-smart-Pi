import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnalyticsService, InterventionTrackingItem } from '../../modules/analytics/services/analytics.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-instructor-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instructor-sidebar.component.html',
  styleUrls: ['./instructor-sidebar.component.css']
})
export class InstructorSidebarComponent implements OnInit {
  criticalCases = 0;
  topRiskMessage = 'No critical learning alerts right now.';

  constructor(private analyticsService: AnalyticsService) { }

  ngOnInit(): void {
    this.loadInsightCard();
  }

  private loadInsightCard(): void {
    this.analyticsService
      .getInterventions()
      .pipe(catchError(() => of([] as InterventionTrackingItem[])))
      .subscribe((rows) => {
        const interventions = Array.isArray(rows) ? rows : [];
        const critical = interventions.filter(
          (item) => item.status === 'pending' && item.riskLevel === 'high',
        );
        this.criticalCases = critical.length;

        if (critical.length === 0) {
          this.topRiskMessage = 'No critical learning alerts right now.';
          return;
        }

        const top = critical
          .slice(0, 2)
          .map((item) => item.name)
          .filter((name) => !!name)
          .join(', ');
        this.topRiskMessage = top
          ? `${critical.length} high-risk students pending: ${top.toLowerCase()}.`
          : `${critical.length} high-risk students need follow-up.`;
      });
  }
}
