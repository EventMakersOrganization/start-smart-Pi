import { NgModule } from '@angular/core';
import { AnalyticsSharedModule } from './analytics-shared.module';
import { AnalyticsRoutingModule } from './analytics-routing.module';

@NgModule({
  imports: [AnalyticsSharedModule, AnalyticsRoutingModule],
})
export class AnalyticsModule {}
