import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';

interface CourseCard {
  id: string;
  title: string;
  instructor: string;
  category: string;
  categoryColor: string;
  progress: number;
  thumbnail: string;
  lastViewed: string;
  completionLabel: string;
  progressColor: string;
}

interface CoursesApiResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

@Component({
  selector: 'app-my-courses',
  templateUrl: './my-courses.component.html',
  styleUrls: ['./my-courses.component.css'],
})
export class MyCoursesComponent implements OnInit {
  user: any = null;
  courses: CourseCard[] = [];
  filteredCourses: CourseCard[] = [];
  categoryFilters: string[] = [];
  activeFilter = 'all';
  sortBy = 'recent';
  profileDrawerOpen = false;
  darkMode = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private adaptiveService: AdaptiveLearningService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadCourses();
    this.checkDarkMode();
  }

  private checkDarkMode(): void {
    this.darkMode = document.documentElement.classList.contains('dark');
  }

  private loadCourses(): void {
    this.http
      .get<CoursesApiResponse>(
        'http://localhost:3000/api/courses?page=1&limit=100',
      )
      .subscribe({
        next: (response) => {
          const palette = ['bg-primary', 'bg-emerald-500', 'bg-purple-500'];
          const categoryPalette = [
            'bg-blue-500/90',
            'bg-emerald-500/90',
            'bg-purple-500/90',
            'bg-orange-500/90',
            'bg-pink-500/90',
            'bg-cyan-500/90',
          ];
          const thumbs = [
            'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
          ];

          const usedCategories: string[] = [];

          this.courses = (response?.data || []).map(
            (course: any, index: number) => {
              const progress = 0;
              const category = this.extractChapterCategory(course?.title);

              if (!usedCategories.includes(category)) {
                usedCategories.push(category);
              }

              return {
                id: course?._id || course?.id || String(index + 1),
                title: course?.title || `Course ${index + 1}`,
                instructor:
                  course?.instructorId?.name ||
                  course?.instructor?.name ||
                  'Enseignant',
                category,
                categoryColor:
                  categoryPalette[
                    usedCategories.indexOf(category) % categoryPalette.length
                  ],
                progress,
                thumbnail: thumbs[index % thumbs.length],
                lastViewed: 'Not started',
                completionLabel: `${progress}% Complete`,
                progressColor: palette[index % palette.length],
              } as CourseCard;
            },
          );

          this.categoryFilters = usedCategories;

          this.filterAndSort();
        },
        error: () => {
          this.courses = [];
          this.categoryFilters = [];
          this.filterAndSort();
        },
      });
  }

  private extractChapterCategory(title: string | undefined): string {
    if (!title) return 'Autre';

    const chapterMatch = title.match(/Chapitre\s*\d+/i);
    if (chapterMatch?.[0]) {
      const normalized = chapterMatch[0].replace(/\s+/g, ' ').trim();
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    return 'Autre';
  }

  filterByCategory(category: string): void {
    this.activeFilter = category;
    this.filterAndSort();
  }

  sortCourses(event: any): void {
    const sortOption = event.target?.value || 'recent';
    this.sortBy = sortOption;
    this.filterAndSort();
  }

  private filterAndSort(): void {
    let filtered = this.courses;

    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(
        (c) => c.category.toLowerCase() === this.activeFilter.toLowerCase(),
      );
    }

    if (this.sortBy === 'progress') {
      filtered.sort((a, b) => b.progress - a.progress);
    } else if (this.sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }
    // 'recent' is already in original order

    this.filteredCourses = filtered;
  }

  continueLearning(courseId: string): void {
    this.router.navigate([`/student-dashboard/continue-learning/${courseId}`]);
  }

  toggleProfileDrawer(): void {
    this.profileDrawerOpen = !this.profileDrawerOpen;
  }

  closeProfileDrawer(): void {
    this.profileDrawerOpen = false;
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  logout(): void {
    this.authService.logout();
  }

  get inProgressCount(): number {
    return this.courses.filter((c) => c.progress < 100).length;
  }
}
