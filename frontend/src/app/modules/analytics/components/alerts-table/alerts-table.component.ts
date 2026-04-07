import { Component, Input, OnInit } from '@angular/core';
import type { Alert } from '../../models/analytics.models';

@Component({
  selector: 'app-alerts-table',
  templateUrl: './alerts-table.component.html',
  styleUrls: ['./alerts-table.component.css']
})
export class AlertsTableComponent implements OnInit {
  @Input() alerts: Alert[] = [];
  @Input() loading: boolean = false;

  ngOnInit(): void {
    // Alerts are provided via @Input
  }

  /**
   * Get severity badge color
   */
  getSeverityClass(severity: string): string {
    const classes = {
      'HIGH': 'bg-red-100 dark:bg-red-900/30 text-red-600',
      'MEDIUM': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
      'LOW': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
    };
    return classes[severity as keyof typeof classes] || classes['LOW'];
  }

  /**
   * Get status badge color
   */
  getStatusClass(resolved: boolean): string {
    return resolved 
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-900/50'
      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 ring-1 ring-amber-200 dark:ring-amber-900/50';
  }

  /**
   * Get status text
   */
  getStatusText(resolved: boolean): string {
    return resolved ? 'Resolved' : 'Needs Review';
  }

  /**
   * Get alert date with fallback to current date if undefined
   */
  getAlertDate(date: Date | string | undefined): Date {
    return date ? new Date(date) : new Date();
  }
  /**
   * Format date to relative time
   */
  formatDate(date: Date | string): string {
    const now = new Date();
    const alertDate = new Date(date);
    const diffMs = now.getTime() - alertDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return alertDate.toLocaleDateString();
  }

  /**
   * Get student initials for avatar
   */
  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }

  /**
   * Get consistent avatar color based on name
   */
  getAvatarColor(name: string): string {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }
}
