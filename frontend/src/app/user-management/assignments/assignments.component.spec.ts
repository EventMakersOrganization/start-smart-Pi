import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AssignmentsComponent } from './assignments.component';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('AssignmentsComponent', () => {
  let component: AssignmentsComponent;
  let fixture: ComponentFixture<AssignmentsComponent>;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockUser = {
    id: 'instructor123',
    _id: 'instructor123',
    first_name: 'John',
    last_name: 'Doe',
    role: 'instructor',
    email: 'john@example.com'
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getUser', 'logout']);
    authServiceSpy.getUser.and.returnValue(mockUser);

    await TestBed.configureTestingModule({
      declarations: [ AssignmentsComponent ],
      imports: [ 
        HttpClientTestingModule, 
        RouterTestingModule,
        FormsModule
      ],
      providers: [
        { provide: AuthService, useValue: authServiceSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitialLoad() {
    fixture.detectChanges();
    const req = httpMock.expectOne(r => r.url.includes('api/courses') && r.method === 'GET');
    req.flush({ data: [] });
  }

  it('should create', () => {
    flushInitialLoad();
    expect(component).toBeTruthy();
  });

  it('should initialize as instructor and load courses', () => {
    fixture.detectChanges();
    
    const req = httpMock.expectOne(req => 
      req.url.includes('api/courses') && 
      req.urlWithParams.includes('instructorId=instructor123')
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ _id: 'c1', title: 'Test Course' }] });
    
    expect(component.isInstructor).toBeTrue();
    expect(component.instructorCourses.length).toBe(1);
    expect(component.instructorCourses[0].title).toBe('Test Course');
  });

  it('should handle course loading error', () => {
    fixture.detectChanges();
    
    const req = httpMock.expectOne(req => req.url.includes('api/courses'));
    req.flush('Error', { status: 500, statusText: 'Server Error' });
    
    expect(component.error).toBe('Failed to load courses.');
    expect(component.loadingCourses).toBeFalse();
  });

  describe('Form Logic', () => {
    beforeEach(() => {
      flushInitialLoad();
    });

    it('should open create course form', () => {
      component.openCreateCourse();
      expect(component.showCourseForm).toBeTrue();
      expect(component.editingCourseId).toBeNull();
      expect(component.courseForm.title).toBe('');
    });

    it('should open edit course form with data', () => {
      const mockCourse = { _id: 'c1', title: 'Edit Me', description: 'D', level: 'L', subject: 'S', subChapters: [] };
      component.editCourse(mockCourse);
      expect(component.showCourseForm).toBeTrue();
      expect(component.editingCourseId).toBe('c1');
      expect(component.courseForm.title).toBe('Edit Me');
    });

    it('should add and remove sub-chapters', () => {
      component.openCreateCourse();
      expect(component.courseForm.subChapters.length).toBe(1);
      
      component.addSubChapter();
      expect(component.courseForm.subChapters.length).toBe(2);
      
      component.removeSubChapter(0);
      expect(component.courseForm.subChapters.length).toBe(1);
    });

    it('should show error if required fields are missing on save', () => {
        component.openCreateCourse();
        component.courseForm.title = ''; // missing
        component.saveCourse();
        expect(component.error).toContain('required');
    });

    it('should call POST API on save for new course', fakeAsync(() => {
        component.openCreateCourse();
        component.courseForm = {
            title: 'New',
            description: 'Desc',
            level: 'L1',
            subject: 'Sub',
            subChapters: [{ title: 'M1', description: '' }]
        };
        component.saveCourse();

        // The save request
        const req = httpMock.expectOne(r => r.url.includes('api/courses') && r.method === 'POST');
        req.flush({ _id: 'new-id' });
        tick();
        fixture.detectChanges();

        // loadInstructorCourses is called after success
        const reloadReq = httpMock.expectOne(r => r.url.includes('api/courses') && r.method === 'GET');
        reloadReq.flush({ data: [] });
        tick();
        fixture.detectChanges();
        
        expect(component.message).toContain('created successfully');
    }));
  });

  it('should call logout', () => {
      flushInitialLoad();
      component.logout();
      expect(authServiceSpy.logout).toHaveBeenCalled();
  });
});
