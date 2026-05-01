import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { MyCoursesComponent } from './my-courses.component';
import { AuthService } from '../auth.service';
import { SubjectsService } from '../subjects.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { QuizSubmissionService } from '../quiz-submission.service';
import { PrositSubmissionService } from '../prosit-submission.service';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('MyCoursesComponent', () => {
  let component: MyCoursesComponent;
  let fixture: ComponentFixture<MyCoursesComponent>;
  let subjectsServiceSpy: jasmine.SpyObj<SubjectsService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockUser = { id: 'u1', _id: 'u1', first_name: 'Alex' };

  beforeEach(async () => {
    subjectsServiceSpy = jasmine.createSpyObj('SubjectsService', ['getSubjects', 'getSubjectLearningProgress']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getUser']);
    
    authServiceSpy.getUser.and.returnValue(mockUser);
    subjectsServiceSpy.getSubjects.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [ MyCoursesComponent ],
      imports: [ 
        HttpClientTestingModule, 
        RouterTestingModule
      ],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: SubjectsService, useValue: subjectsServiceSpy },
        {
          provide: AdaptiveLearningService,
          useValue: { 
            getUnifiedStudentProfile: () => of({ profile: { attendance_percentage: 90 } }),
            recordActivity: () => of({}),
            getLevelTest: () => of([])
          }
        },
        { 
            provide: QuizSubmissionService, 
            useValue: { 
                getStudentQuizSubmissions: () => of([]),
                getStudentQuizFileSubmissions: () => of([])
            } 
        },
        { 
            provide: PrositSubmissionService, 
            useValue: { 
                getStudentPrositSubmissions: () => of({ submissions: [] }) 
            } 
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of({ get: () => null }),
            snapshot: {
                queryParamMap: {
                    get: () => null
                }
            }
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(MyCoursesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load subjects on init', () => {
    const mockSubjects = [{ _id: 's1', title: 'Math', chapters: [] }];
    subjectsServiceSpy.getSubjects.and.returnValue(of(mockSubjects as any));
    
    fixture.detectChanges();
    
    expect(subjectsServiceSpy.getSubjects).toHaveBeenCalled();
    expect(component.subjects.length).toBeGreaterThan(0);
    expect(component.subjects[0].name).toBe('Math');
  });

  describe('Tab Navigation', () => {
    it('should change viewMode', () => {
      component.viewMode = 'grades' as any;
      expect(component.viewMode).toBe('grades');
    });

    it('should set active subject and viewMode to courses', () => {
        const subject = { name: 'Science', courses: [] };
        component.openSubject(subject as any);
        expect(component.selectedSubject).toBe(subject as any);
        expect(component.viewMode).toBe('courses');
    });
  });

  it('should display grade items when provided', () => {
      component.subjectGradeItems = [
          { name: 'Quiz 1', status: 'Noté', gradeText: '10/10', type: 'quiz' }
      ] as any;
      
      expect(component.subjectGradeItems.length).toBe(1);
  });
});
