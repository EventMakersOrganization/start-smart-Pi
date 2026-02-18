import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth.service';

interface Activity {
  _id: string;
  userId: {
    name: string;
    email: string;
  };
  action: string;
  timestamp: string;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activities: Activity[] = [];

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() {
    this.loadActivities();
  }

  loadActivities() {
    this.http.get<Activity[]>('http://localhost:3000/api/admin/activity').subscribe({
      next: (data) => {
        this.activities = data;
      },
      error: (error) => {
        console.error('Failed to load activities', error);
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
