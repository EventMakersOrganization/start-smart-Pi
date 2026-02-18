import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ProfileComponent } from './profile/profile.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RoleGuard } from './role.guard';
import { JwtInterceptor } from './jwt.interceptor';
import { StudentDashboardComponent } from './student-dashboard/student-dashboard.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin'] } },
  { path: 'student-dashboard', component: StudentDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['student'] } },
];

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    ProfileComponent,
    AdminDashboardComponent,
    StudentDashboardComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
