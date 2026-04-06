import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ProfileComponent } from './profile/profile.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { StudentManagementComponent } from './student-management/student-management.component';
import { TeacherManagementComponent } from './teacher-management/teacher-management.component';
import { InstructorDashboardComponent } from './instructor-dashboard/instructor-dashboard.component';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RoleGuard } from './role.guard';
import { JwtInterceptor } from './jwt.interceptor';
import { StudentDashboardComponent } from './student-dashboard/student-dashboard.component';
import { SubjectsManagementComponent } from './subjects-management/subjects-management.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', redirectTo: 'students', pathMatch: 'full' },
      { path: 'students', component: StudentManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin'] } },
      { path: 'instructors', component: TeacherManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin'] } },
      { path: 'subjects', component: SubjectsManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin'] } },
    ]
  },
  { path: 'student-dashboard', component: StudentDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['student'] } },
  { path: 'student/dashboard', component: StudentDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['student'] } },

  // instructor dashboard
  { path: 'instructor/dashboard', component: InstructorDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['instructor'] } },
];

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    ProfileComponent,
    AdminDashboardComponent,
    StudentDashboardComponent,
    StudentManagementComponent,
    TeacherManagementComponent,
    SubjectsManagementComponent,
    InstructorDashboardComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    AuthService,
    AuthGuard,
    RoleGuard,
    JwtInterceptor
  ]
})
export class UserManagementModule { }
