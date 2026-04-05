import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AdaptiveLearningService,
  ChatMessage,
} from '../adaptive-learning.service';

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
  tutorQuestion = '';
  tutorLoading = false;
  tutorError = '';
  tutorMessages: ChatMessage[] = [
    {
      role: 'assistant',
      content:
        'Ask me anything about this lesson. I can explain concepts step by step or give an easier summary.',
    },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adaptiveService: AdaptiveLearningService,
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

  sendTutorQuestion(): void {
    const question = this.tutorQuestion.trim();
    if (!question || this.tutorLoading) return;

    this.tutorMessages = [
      ...this.tutorMessages,
      { role: 'user', content: question },
    ];
    this.tutorQuestion = '';
    this.tutorLoading = true;
    this.tutorError = '';

    this.adaptiveService
      .askChatbot({
        question,
        conversation_history: this.tutorMessages,
      })
      .subscribe({
        next: (response) => {
          this.tutorMessages = [
            ...this.tutorMessages,
            {
              role: 'assistant',
              content:
                response?.answer ||
                'I could not generate an answer right now. Please try again.',
            },
          ];
          this.tutorLoading = false;
        },
        error: () => {
          this.tutorError = 'Unable to load tutor answer.';
          this.tutorLoading = false;
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/student-dashboard/my-courses']);
  }
}
