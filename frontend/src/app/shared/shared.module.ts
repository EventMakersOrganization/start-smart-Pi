import { NgModule } from '@angular/core';
import { BrandLogoComponent } from './brand-logo/brand-logo.component';

/**
 * Re-exports shared standalone pieces for classic NgModules.
 */
@NgModule({
  imports: [BrandLogoComponent],
  exports: [BrandLogoComponent],
})
export class SharedModule {}
