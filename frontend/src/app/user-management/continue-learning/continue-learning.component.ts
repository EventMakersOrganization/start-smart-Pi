import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

interface Lesson {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  expanded: boolean;
}

@Component({
  selector: 'app-continue-learning',
  templateUrl: './continue-learning.component.html',
  styleUrls: ['./continue-learning.component.css'],
})
export class ContinueLearningComponent implements OnInit {
  courseId: string = '1';
  courseName = 'Mastering PyTorch for Deep Learning Research';
  instructor = 'Dr. Sarah Chen';
  progress = 65;
  currentModule = 'Module 2';
  currentLesson = 'Building Multi-layer Perceptrons';
  totalDuration = '45 mins';
  videoDuration = '24:05';
  videoCurrentTime = '10:45';
  videoProgress = 45;

  modules: Module[] = [
    {
      id: '1',
      title: 'Foundations of PyTorch',
      expanded: false,
      lessons: [
        {
          id: 'L1',
          title: 'Introduction to Tensors',
          duration: '12:40',
          completed: true,
        },
        {
          id: 'L2',
          title: 'Autograd Mechanics',
          duration: '18:15',
          completed: true,
        },
      ],
    },
    {
      id: '2',
      title: 'Neural Networks Arch',
      expanded: true,
      lessons: [
        {
          id: 'L3',
          title: 'Building Multi-layer Perceptrons',
          duration: '24:05',
          completed: false,
        },
        {
          id: 'L4',
          title: 'Activation Functions',
          duration: '15:20',
          completed: false,
        },
      ],
    },
    {
      id: '3',
      title: 'Optimization & Training',
      expanded: false,
      lessons: [],
    },
    {
      id: '4',
      title: 'Convolutional Networks',
      expanded: false,
      lessons: [],
    },
  ];

  activeTab = 'overview';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      if (params['courseId']) {
        this.courseId = params['courseId'];
      }
    });
  }

  toggleModule(moduleId: string): void {
    const module = this.modules.find((m) => m.id === moduleId);
    if (module) {
      module.expanded = !module.expanded;
    }
  }

  selectLesson(lessonId: string): void {
    console.log('Selected lesson:', lessonId);
  }

  previousLesson(): void {
    this.router.navigate(['/student-dashboard/my-courses']);
  }

  nextLesson(): void {
    console.log('Go to next lesson');
  }

  saveLesson(): void {
    console.log('Lesson saved');
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.router.navigate(['/student-dashboard/my-courses']);
  }
}
