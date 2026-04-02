import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface AssignmentCard {
  id: number;
  status: 'Urgent' | 'Upcoming' | 'Graded';
  title: string;
  subtitle: string;
  dueText: string;
  subject: string;
  aiLevel: string;
  actionLabel: string;
  statusColor: string;
  accentColor: string;
}

@Component({
  selector: 'app-assignments',
  templateUrl: './assignments.component.html',
  styleUrls: ['./assignments.component.css'],
})
export class AssignmentsComponent {
  user = {
    first_name: 'Alex',
    last_name: 'Johnson',
    role: 'Undergraduate',
    email: 'alex.j@eduai.platform',
    phone: '+1 (555) 0123-4567',
  };

  stats = {
    pending: 3,
    completed: 12,
    overdue: 1,
  };

  activeTab = 'upcoming';

  assignments: AssignmentCard[] = [
    {
      id: 1,
      status: 'Urgent',
      title: 'Deep Learning Fundamentals',
      subtitle: 'Module 4: Backpropagation & Optimization',
      dueText: 'Due: Oct 24, 2023 (In 4 hours)',
      subject: 'Computer Science',
      aiLevel: 'Hard',
      actionLabel: 'Start Assignment',
      statusColor:
        'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
      accentColor: 'border-red-200 dark:border-red-900/30',
    },
    {
      id: 2,
      status: 'Upcoming',
      title: 'Calculus & Linear Algebra',
      subtitle: 'Problem Set #12: Vector Spaces',
      dueText: 'Due: Oct 28, 2023',
      subject: 'Mathematics',
      aiLevel: 'Medium',
      actionLabel: 'Start Assignment',
      statusColor:
        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      accentColor: 'border-slate-200 dark:border-slate-800',
    },
    {
      id: 3,
      status: 'Graded',
      title: 'Cognitive Psychology',
      subtitle: 'Essay: Neural Correlates of Memory',
      dueText: 'Feedback Ready',
      subject: 'Psychology',
      aiLevel: 'Easy',
      actionLabel: 'View Feedback',
      statusColor:
        'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      accentColor: 'border-slate-200 dark:border-slate-800',
    },
  ];

  constructor(private router: Router) {}

  selectTab(tab: string): void {
    this.activeTab = tab;
  }

  openSubmission(): void {
    this.router.navigate(['/student-dashboard/assignments/submission']);
  }
}
