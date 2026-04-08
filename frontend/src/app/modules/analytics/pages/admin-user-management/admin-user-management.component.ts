import { Component, OnInit } from '@angular/core';
import { UsersService } from '../../services/users.service';
import { User } from '../../models/analytics.models';

@Component({
  selector: 'app-admin-user-management',
  templateUrl: './admin-user-management.component.html',
  styleUrls: ['./admin-user-management.component.css'],
})
export class AdminUserManagementComponent implements OnInit {
  users: User[] = [];
  loading: boolean = true;
  error: string = '';
  selectedUser: User | null = null;
  showDetailsModal: boolean = false;

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';

    this.usersService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.error = 'Failed to load users. Please try again.';
        this.loading = false;
      },
    });
  }

  refreshUsers(): void {
    this.loadUsers();
  }

  openDetailsModal(user: User): void {
    this.selectedUser = user;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.selectedUser = null;
    this.showDetailsModal = false;
  }

  getRoleBadgeClass(role: string): string {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'instructor':
      case 'teacher':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'student':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  }

  getRiskBadgeClass(riskLevel: string): string {
    switch (riskLevel?.toLowerCase()) {
      case 'low':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'high':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
    }
  }

  getRiskLabel(riskLevel: string): string {
    if (!riskLevel) return 'N/A';
    return riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1).toLowerCase();
  }

  getRoleLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'inactive':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      case 'suspended':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  }

  getStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  getUserFullName(user: User): string {
    return `${user.first_name} ${user.last_name}`;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStudentCount(): number {
    return this.users.filter(u => u.role.toLowerCase() === 'student').length;
  }

  getInstructorCount(): number {
    return this.users.filter(u => u.role.toLowerCase() === 'instructor' || u.role.toLowerCase() === 'teacher').length;
  }

  getAdminCount(): number {
    return this.users.filter(u => u.role.toLowerCase() === 'admin').length;
  }

  trackByUserId(_: number, user: User): string {
    return user.id;
  }
}
