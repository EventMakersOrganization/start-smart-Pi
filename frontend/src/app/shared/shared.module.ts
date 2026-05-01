import { NgModule } from '@angular/core';
import { BrandLogoComponent } from './brand-logo/brand-logo.component';
import { StudentSidebarComponent } from './student-sidebar/student-sidebar.component';
import { InstructorSidebarComponent } from './instructor-sidebar/instructor-sidebar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';
import { ProfileSidebarComponent } from './profile-sidebar/profile-sidebar.component';

/**
 * Re-exports shared standalone pieces for classic NgModules.
 */
@NgModule({
  imports: [BrandLogoComponent, StudentSidebarComponent, InstructorSidebarComponent, NavbarComponent, AdminSidebarComponent, ProfileSidebarComponent],
  exports: [BrandLogoComponent, StudentSidebarComponent, InstructorSidebarComponent, NavbarComponent, AdminSidebarComponent, ProfileSidebarComponent],
})
export class SharedModule {}
