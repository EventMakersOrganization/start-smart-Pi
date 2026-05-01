import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SubjectsService, normalizeSubjectItem, SubjectItem } from './subjects.service';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let httpMock: HttpTestingController;

  const mockSubjectRaw = {
    id: '123',
    title: 'Mathematics',
    code: 'MATH101',
    chapters: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SubjectsService]
    });
    service = TestBed.inject(SubjectsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getSubjects', () => {
    it('should fetch subjects from courses API by default (preferCoursesView=true)', () => {
      const mockRows = [mockSubjectRaw];
      
      service.getSubjects().subscribe(subjects => {
        expect(subjects.length).toBe(1);
        expect(subjects[0]._id).toBe('123');
        expect(subjects[0].title).toBe('Mathematics');
      });

      const req = httpMock.expectOne('http://localhost:3000/api/courses/subjects/list');
      expect(req.request.method).toBe('GET');
      req.flush(mockRows);
    });

    it('should fetch subjects from subjects API when preferCoursesView is false', () => {
      service.getSubjects(undefined, false).subscribe();

      const req = httpMock.expectOne('http://localhost:3000/api/subjects');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should handle error from API', () => {
        service.getSubjects().subscribe({
            next: () => fail('should have failed with 500 error'),
            error: (error) => {
                expect(error.status).toBe(500);
            }
        });

        const req = httpMock.expectOne('http://localhost:3000/api/courses/subjects/list');
        req.flush('Error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('getSubject', () => {
    it('should fetch a single subject by ID', () => {
      service.getSubject('123', false).subscribe(subject => {
        expect(subject._id).toBe('123');
      });

      const req = httpMock.expectOne('http://localhost:3000/api/subjects/123');
      req.flush(mockSubjectRaw);
    });

    it('should fetch by title if ID starts with course-subject: and preferCoursesView is true', () => {
        service.getSubject('course-subject:Math', true).subscribe();
        
        const req = httpMock.expectOne('http://localhost:3000/api/courses/subjects/by-title/Math');
        expect(req.request.method).toBe('GET');
        req.flush(mockSubjectRaw);
    });
  });

  describe('normalizeSubjectItem', () => {
    it('should map id to _id', () => {
      const raw = { id: 'abc', title: 'Test' };
      const normalized = normalizeSubjectItem(raw);
      expect(normalized._id).toBe('abc');
    });

    it('should use _id if present', () => {
      const raw = { _id: 'xyz', title: 'Test' };
      const normalized = normalizeSubjectItem(raw);
      expect(normalized._id).toBe('xyz');
    });

    it('should default chapters to an empty array', () => {
        const normalized = normalizeSubjectItem({ id: '1' });
        expect(normalized.chapters).toEqual([]);
    });
  });

  describe('createSubject', () => {
      it('should post new subject data', () => {
          const payload = { title: 'Physics', description: 'Study of matter' };
          service.createSubject(payload).subscribe();

          const req = httpMock.expectOne('http://localhost:3000/api/subjects');
          expect(req.request.method).toBe('POST');
          expect(req.request.body.title).toBe('Physics');
          req.flush(mockSubjectRaw);
      });
  });
});
