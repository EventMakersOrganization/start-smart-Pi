import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { StudentDashboardComponent } from './student-dashboard.component';
import { AuthService } from '../auth.service';
import { AdaptiveLearningService } from '../adaptive-learning.service';
import { SubjectsService } from '../subjects.service';

describe('StudentDashboardComponent', () => {
  let component: StudentDashboardComponent;
  let fixture: ComponentFixture<StudentDashboardComponent>;

  const authServiceMock = {
    getUser: jasmine.createSpy('getUser').and.returnValue({ _id: '123', first_name: 'John' })
  };

  const adaptiveServiceMock = {
    getLearningRecommendationsStream: jasmine.createSpy('getLearningRecommendationsStream').and.returnValue(of([])),
    getAdaptiveLearningState: jasmine.createSpy('getAdaptiveLearningState').and.returnValue(of({})),
    getProfile: jasmine.createSpy('getProfile').and.returnValue(of({})),
    getPerformances: jasmine.createSpy('getPerformances').and.returnValue(of([])),
    getRecommendations: jasmine.createSpy('getRecommendations').and.returnValue(of([])),
    getGoalSettings: jasmine.createSpy('getGoalSettings').and.returnValue(of({})),
    getPersonalizedRecommendationsFromAi: jasmine.createSpy('getPersonalizedRecommendationsFromAi').and.returnValue(of({}))
  };

  const subjectsServiceMock = {
    getSubjects: jasmine.createSpy('getSubjects').and.returnValue(of([]))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [StudentDashboardComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: AdaptiveLearningService, useValue: adaptiveServiceMock },
        { provide: SubjectsService, useValue: subjectsServiceMock }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentDashboardComponent);
    component = fixture.componentInstance;
    // fixture.detectChanges(); // Do not detect changes here because it triggers ngOnInit which calls many services
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
