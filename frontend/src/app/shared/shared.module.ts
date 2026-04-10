import { NgModule } from '@angular/core';
import { BrandLogoComponent } from './brand-logo/brand-logo.component';
import { ToastComponent } from './components/toast.component';

/**
 * Re-exports shared standalone pieces for classic NgModules.
 */
@NgModule({
  imports: [BrandLogoComponent, ToastComponent],
  exports: [BrandLogoComponent, ToastComponent],
})
export class SharedModule { }
