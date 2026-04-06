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
import { AdaptiveLearningService } from './adaptive-learning.service';
import { LevelTestComponent } from './level-test/level-test.component';
import { LevelTestResultComponent } from './level-test-result/level-test-result.component';
import { ProgressChartsComponent } from './progress-charts/progress-charts.component';
import { PerformanceHistoryComponent } from './performance-history/performance-history.component';
import { RecommendationDisplayComponent } from './recommendation-display/recommendation-display.component';
import { LearningPathComponent } from './learning-path/learning-path.component';
import { SkillMasteryComponent } from './skill-mastery/skill-mastery.component';
import { GoalSettingComponent } from './goal-setting/goal-setting.component';
import { BadgeDisplayComponent } from './badge-display/badge-display.component';
import { PeerComparisonComponent } from './peer-comparison/peer-comparison.component';
import { StudyPlannerComponent } from './study-planner/study-planner.component';
import { MyCoursesComponent } from './my-courses/my-courses.component';
import { ContinueLearningComponent } from './continue-learning/continue-learning.component';
import { AssignmentsComponent } from './assignments/assignments.component';
import { AssignmentSubmissionComponent } from './assignment-submission/assignment-submission.component';
import { ProgressReportsComponent } from './progress-reports/progress-reports.component';
import { InstructorSubjectsComponent } from './instructor-subjects/instructor-subjects.component';

const routes: Routes = [
  {
    path: 'progress-reports',
    component: ProgressReportsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'progress-reports/:studentId',
    component: ProgressReportsComponent,
    canActivate: [AuthGuard],
  },
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
      {
        path: 'students',
        component: StudentManagementComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] },
      },
      {
        path: 'instructors',
        component: TeacherManagementComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['admin'] },
      },
    ],
  },
  {
    path: 'student-dashboard',
    component: StudentDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['student'] },
    children: [
      {
        path: 'level-test',
        component: LevelTestComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'level-test-result',
        component: LevelTestResultComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'goal-setting',
        component: GoalSettingComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'badges',
        component: BadgeDisplayComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'my-courses',
        component: MyCoursesComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'performance',
        component: PerformanceHistoryComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'learning-path',
        component: LearningPathComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'assignments',
        component: AssignmentsComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'assignments/submission',
        component: AssignmentSubmissionComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
      {
        path: 'continue-learning/:courseId',
        component: ContinueLearningComponent,
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['student'] },
      },
    ],
  },
  {
    path: 'student/dashboard',
    redirectTo: 'student-dashboard',
    pathMatch: 'full',
  },

  // Level Test route
  {
    path: 'level-test',
    redirectTo: 'student-dashboard/level-test',
    pathMatch: 'full',
  },
  {
    path: 'level-test/result',
    redirectTo: 'student-dashboard/level-test-result',
    pathMatch: 'full',
  },

  // instructor dashboard
  {
    path: 'instructor/dashboard',
    component: InstructorDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor'] },
  },
  {
    path: 'instructor/assignments',
    redirectTo: 'instructor/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'instructor/subjects',
    component: InstructorSubjectsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor'] },
  },
  {
    path: 'instructor/subjects/:id',
    component: InstructorSubjectsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['instructor'] },
  },
  {
    path: 'goal-setting',
    redirectTo: 'student-dashboard/goal-setting',
    pathMatch: 'full',
  },
  {
    path: 'badges',
    redirectTo: 'student-dashboard/badges',
    pathMatch: 'full',
  },
  {
    path: 'my-courses',
    redirectTo: 'student-dashboard/my-courses',
    pathMatch: 'full',
  },
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
    InstructorDashboardComponent,
    LevelTestComponent,
    LevelTestResultComponent,
    ProgressChartsComponent,
    PerformanceHistoryComponent,
    RecommendationDisplayComponent,
    LearningPathComponent,
    SkillMasteryComponent,
    GoalSettingComponent,
    BadgeDisplayComponent,
    PeerComparisonComponent,
    StudyPlannerComponent,
    MyCoursesComponent,
    ContinueLearningComponent,
    AssignmentsComponent,
    AssignmentSubmissionComponent,
    ProgressReportsComponent,
    InstructorSubjectsComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes),
  ],
  providers: [
    AuthService,
    AuthGuard,
    RoleGuard,
    JwtInterceptor,
    AdaptiveLearningService,
  ],
})
export class UserManagementModule {}
