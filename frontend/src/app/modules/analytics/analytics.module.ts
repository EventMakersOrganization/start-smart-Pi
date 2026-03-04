import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AnalyticsRoutingModule } from './analytics-routing.module';
import { InstructorDashboardComponent } from './pages/instructor-dashboard/instructor-dashboard.component';
import { DeepAnalyticsComponent } from './pages/deep-analytics/deep-analytics.component';
import { RiskDetectionManagementComponent } from './pages/risk-detection-management/risk-detection-management.component';
import { AdminSystemMetricsDashboardComponent } from './pages/admin-system-metrics-dashboard/admin-system-metrics-dashboard.component';
import { AdminUserManagementComponent } from './pages/admin-user-management/admin-user-management.component';
import { AdminExplainabilityComponent } from './pages/admin-explainability/admin-explainability.component';
import { RiskScoreService } from './services/riskscore.service';
import { AlertService } from './services/alert.service';
import { UsersService } from './services/users.service';

@NgModule({
  declarations: [
    InstructorDashboardComponent,
    DeepAnalyticsComponent,
    RiskDetectionManagementComponent,
    AdminSystemMetricsDashboardComponent,
    AdminUserManagementComponent,
    AdminExplainabilityComponent,
  ],
  imports: [
    CommonModule,
    AnalyticsRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
  ],
  providers: [
    RiskScoreService,
    AlertService,
    UsersService,
  ],
})
export class AnalyticsModule {}
