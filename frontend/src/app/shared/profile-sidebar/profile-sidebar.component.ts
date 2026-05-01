import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-sidebar.component.html',
  styleUrls: ['./profile-sidebar.component.css']
})
export class ProfileSidebarComponent {
  @Input() user: any;
  @Input() show: boolean = false;
  
  // Student specific stats (optional)
  @Input() studyHours: number = 0;
  @Input() coursesCount: number = 0;

  @Output() close = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() manageAccount = new EventEmitter<void>();

  get isStudent(): boolean {
    const role = String(this.user?.role || '').toLowerCase();
    return role === 'student';
  }

  get isInstructor(): boolean {
    const role = String(this.user?.role || '').toLowerCase();
    return role === 'instructor';
  }

  get isAdmin(): boolean {
    const role = String(this.user?.role || '').toLowerCase();
    return role === 'admin';
  }

  get title(): string {
    if (this.isInstructor) return 'Instructor Profile';
    if (this.isAdmin) return 'Admin Profile';
    return 'My Profile';
  }

  onClose() {
    this.close.emit();
  }

  onLogout() {
    this.logout.emit();
  }

  onManageAccount() {
    this.manageAccount.emit();
  }
}
