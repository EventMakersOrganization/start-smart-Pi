import { Component, Input } from '@angular/core';
import { StudentRiskListItem } from '../../services/analytics.service';

@Component({
  selector: 'app-student-risk-table',
  templateUrl: './student-risk-table.component.html',
  styleUrls: ['./student-risk-table.component.css'],
})
export class StudentRiskTableComponent {
  @Input() students: StudentRiskListItem[] = [];

  getRiskLevelClass(level: string): string {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'high') {
      return 'risk-level high';
    }
    if (normalized === 'medium') {
      return 'risk-level medium';
    }
    return 'risk-level low';
  }

  getAlertStatusClass(status: string): string {
    if (status === 'Pending') {
      return 'alert-status pending';
    }
    if (status === 'Reviewed') {
      return 'alert-status reviewed';
    }
    return 'alert-status resolved';
  }

  trackByStudentUserId(_: number, student: StudentRiskListItem): string {
    return student.userId;
  }
}
