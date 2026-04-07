import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'admin-dashboard',
    redirectTo: '/admin/system-metrics',
    pathMatch: 'full',
  },
  {
    path: 'admin-metrics',
    redirectTo: '/admin/system-metrics',
    pathMatch: 'full',
  },
  {
    path: 'admin-users',
    redirectTo: '/admin/students',
    pathMatch: 'full',
  },
  {
    path: 'admin-explainability',
    redirectTo: '/admin/explainability',
    pathMatch: 'full',
  },
  {
    path: 'instructor-dashboard',
    redirectTo: '/instructor/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'deep-analytics',
    redirectTo: '/instructor/deep-analytics',
    pathMatch: 'full',
  },
  {
    path: 'risk-detection',
    redirectTo: '/instructor/risk-detection',
    pathMatch: 'full',
  },
  {
    path: 'interventions',
    redirectTo: '/instructor/interventions',
    pathMatch: 'full',
  },
  {
    path: 'comprehensive-analytics',
    redirectTo: '/instructor/comprehensive-analytics',
    pathMatch: 'full',
  },
  { path: '', redirectTo: 'instructor-dashboard', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnalyticsRoutingModule {}
