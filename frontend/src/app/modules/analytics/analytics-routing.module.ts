import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../../user-management/auth.guard';
import { RoleGuard } from '../../user-management/role.guard';
import { InstructorDashboardComponent } from './pages/instructor-dashboard/instructor-dashboard.component';
import { DeepAnalyticsComponent } from './pages/deep-analytics/deep-analytics.component';
import { RiskDetectionManagementComponent } from './pages/risk-detection-management/risk-detection-management.component';
import { AdminSystemMetricsDashboardComponent } from './pages/admin-system-metrics-dashboard/admin-system-metrics-dashboard.component';
import { AdminUserManagementComponent } from './pages/admin-user-management/admin-user-management.component';
import { AdminExplainabilityComponent } from './pages/admin-explainability/admin-explainability.component';

const routes: Routes = [
  {
    path: 'instructor-dashboard',
    component: InstructorDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor', 'admin'] },
  },
  {
    path: 'deep-analytics',
    component: DeepAnalyticsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor', 'admin'] },
  },
  {
    path: 'risk-detection',
    component: RiskDetectionManagementComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor', 'admin'] },
  },
  {
    path: 'admin-metrics',
    component: AdminSystemMetricsDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin-users',
    component: AdminUserManagementComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin-explainability',
    component: AdminExplainabilityComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
  },
  { path: '', redirectTo: 'instructor-dashboard', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnalyticsRoutingModule {}
