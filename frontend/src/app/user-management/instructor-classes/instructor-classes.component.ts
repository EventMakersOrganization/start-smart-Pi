import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ClassStudent {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

interface ClassSubject {
  id: string;
  code: string;
  title: string;
}

interface SchoolClassRow {
  id: string;
  code: string;
  name: string;
  description?: string;
  academicYear?: string;
  section?: string;
  level?: string;
  studentCount?: number;
  subjectCount?: number;
  students?: ClassStudent[];
  subjects?: ClassSubject[];
}

@Component({
  selector: 'app-instructor-classes',
  templateUrl: './instructor-classes.component.html',
  styleUrls: ['./instructor-classes.component.css']
})
export class InstructorClassesComponent implements OnInit {
  classes: SchoolClassRow[] = [];
  loading = false;
  error = '';
  
  // Using the same base path as the admin classes, but specifically for the instructor.
  private readonly classesApi = `http://localhost:3000/api/admin/instructor/classes`;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    this.http.get<SchoolClassRow[]>(this.classesApi).subscribe({
      next: (data) => {
        this.classes = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('load classes error', err);
        this.error = 'Failed to load your classes. Please try again later.';
        this.loading = false;
      }
    });
  }

  getTotalStudents(): number {
    return this.classes.reduce((acc, cls) => acc + (cls.studentCount || 0), 0);
  }

  getTotalSubjects(): number {
    return this.classes.reduce((acc, cls) => acc + (cls.subjectCount || 0), 0);
  }
}
