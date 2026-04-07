import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AnalyticsRoutingModule } from './analytics-routing.module';
import { InstructorDashboardComponent } from './pages/instructor-dashboard/instructor-dashboard.component';
import { DeepAnalyticsComponent } from './pages/deep-analytics/deep-analytics.component';
import { RiskDetectionManagementComponent } from './pages/risk-detection-management/risk-detection-management.component';
import { AdminSystemMetricsDashboardComponent } from './pages/admin-system-metrics-dashboard/admin-system-metrics-dashboard.component';
import { AdminUserManagementComponent } from './pages/admin-user-management/admin-user-management.component';
import { AdminExplainabilityComponent } from './pages/admin-explainability/admin-explainability.component';
import { InterventionDashboardComponent } from './pages/intervention-dashboard/intervention-dashboard.component';
import { ComprehensiveAnalyticsDashboardComponent } from './pages/comprehensive-analytics-dashboard/comprehensive-analytics-dashboard.component';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { RiskDistributionChartComponent } from './components/risk-distribution-chart/risk-distribution-chart.component';
import { AlertsTableComponent } from './components/alerts-table/alerts-table.component';
import { RiskChartComponent } from './components/risk-chart/risk-chart.component';
import { AlertsChartComponent } from './components/alerts-chart/alerts-chart.component';
import { StudentRiskTableComponent } from './components/student-risk-table/student-risk-table.component';
import { ExplainabilityDisplayComponent } from './components/explainability-display/explainability-display.component';
import { RiskScoreService } from './services/riskscore.service';
import { AlertService } from './services/alert.service';
import { UsersService } from './services/users.service';
import { ExplainabilityService } from './services/explainability.service';

@NgModule({
  declarations: [
    InstructorDashboardComponent,
    DeepAnalyticsComponent,
    RiskDetectionManagementComponent,
    AdminSystemMetricsDashboardComponent,
    AdminUserManagementComponent,
    AdminExplainabilityComponent,
    InterventionDashboardComponent,
    ComprehensiveAnalyticsDashboardComponent,
    KpiCardComponent,
    RiskDistributionChartComponent,
    AlertsTableComponent,
    RiskChartComponent,
    AlertsChartComponent,
    StudentRiskTableComponent,
    ExplainabilityDisplayComponent,
  ],
  imports: [
    CommonModule,
    AnalyticsRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
  ],
  providers: [
    RiskScoreService,
    AlertService,
    UsersService,
    ExplainabilityService,
  ],
  exports: [InstructorDashboardComponent],
})
export class AnalyticsModule {}
