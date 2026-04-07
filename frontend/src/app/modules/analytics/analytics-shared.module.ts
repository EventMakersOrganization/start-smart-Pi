import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AnalyticsInstructorDashboardComponent } from './pages/instructor-dashboard/instructor-dashboard.component';
import { DeepAnalyticsComponent } from './pages/deep-analytics/deep-analytics.component';
import { RiskDetectionManagementComponent } from './pages/risk-detection-management/risk-detection-management.component';
import { AdminSystemMetricsDashboardComponent } from './pages/admin-system-metrics-dashboard/admin-system-metrics-dashboard.component';
import { AdminUserManagementComponent } from './pages/admin-user-management/admin-user-management.component';
import { AdminExplainabilityComponent } from './pages/admin-explainability/admin-explainability.component';
import { InterventionDashboardComponent } from './pages/intervention-dashboard/intervention-dashboard.component';
import { ComprehensiveAnalyticsDashboardComponent } from './pages/comprehensive-analytics-dashboard/comprehensive-analytics-dashboard.component';
import { ReportBuilderComponent } from './pages/report-builder/report-builder.component';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { RiskDistributionChartComponent } from './components/risk-distribution-chart/risk-distribution-chart.component';
import { AlertsTableComponent } from './components/alerts-table/alerts-table.component';
import { RiskChartComponent } from './components/risk-chart/risk-chart.component';
import { AlertsChartComponent } from './components/alerts-chart/alerts-chart.component';
import { StudentRiskTableComponent } from './components/student-risk-table/student-risk-table.component';
import { ExplainabilityDisplayComponent } from './components/explainability-display/explainability-display.component';
import { ActivityHourChartComponent } from './components/activity-hour-chart/activity-hour-chart.component';
import { RiskScoreService } from './services/riskscore.service';
import { AlertService } from './services/alert.service';
import { UsersService } from './services/users.service';
import { ExplainabilityService } from './services/explainability.service';
import { SharedModule } from '../../shared/shared.module';

/**
 * Shared declarations for analytics pages. Used by lazy AnalyticsModule and by UserManagementModule
 * for /admin/* embedded routes (avoids duplicate RouterModule.forChild registration).
 */
@NgModule({
  declarations: [
    AnalyticsInstructorDashboardComponent,
    DeepAnalyticsComponent,
    RiskDetectionManagementComponent,
    AdminSystemMetricsDashboardComponent,
    AdminUserManagementComponent,
    AdminExplainabilityComponent,
    InterventionDashboardComponent,
    ComprehensiveAnalyticsDashboardComponent,
    ReportBuilderComponent,
    KpiCardComponent,
    RiskDistributionChartComponent,
    AlertsTableComponent,
    RiskChartComponent,
    AlertsChartComponent,
    StudentRiskTableComponent,
    ExplainabilityDisplayComponent,
    ActivityHourChartComponent,
  ],
  imports: [CommonModule, HttpClientModule, ReactiveFormsModule, FormsModule, RouterModule, SharedModule],
  providers: [RiskScoreService, AlertService, UsersService, ExplainabilityService],
  exports: [
    AnalyticsInstructorDashboardComponent,
    DeepAnalyticsComponent,
    RiskDetectionManagementComponent,
    AdminSystemMetricsDashboardComponent,
    AdminUserManagementComponent,
    AdminExplainabilityComponent,
    InterventionDashboardComponent,
    ComprehensiveAnalyticsDashboardComponent,
    ReportBuilderComponent,
    KpiCardComponent,
    RiskDistributionChartComponent,
    AlertsTableComponent,
    RiskChartComponent,
    AlertsChartComponent,
    StudentRiskTableComponent,
    ExplainabilityDisplayComponent,
    ActivityHourChartComponent,
  ],
})
export class AnalyticsSharedModule {}
