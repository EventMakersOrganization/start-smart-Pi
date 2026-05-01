import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VideoGeneratorService, VideoJob } from './video-generator.service';

describe('VideoGeneratorService', () => {
  let service: VideoGeneratorService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:3000/api/video-generator';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VideoGeneratorService]
    });
    service = TestBed.inject(VideoGeneratorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call generate with FormData via POST', () => {
    const mockRes = { jobId: 'job123', status: 'pending' };
    const content = 'Test course';
    
    service.generate(content).subscribe(res => {
      expect(res).toEqual(mockRes);
    });

    const req = httpMock.expectOne(`${baseUrl}/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect(req.request.body.get('courseContent')).toBe(content);
    
    req.flush(mockRes);
  });

  it('should poll status until done', fakeAsync(() => {
    const jobId = 'job123';
    const statusSequence: VideoJob[] = [
      { jobId, status: 'pending', avatarUrl: null, slideCount: 0, scriptTitle: null, error: null },
      { jobId, status: 'processing', avatarUrl: null, slideCount: 0, scriptTitle: null, error: null },
      { jobId, status: 'done', avatarUrl: 'url', slideCount: 5, scriptTitle: 'Title', error: null }
    ];

    let lastResult: VideoJob | undefined;
    const sub = service.pollStatus(jobId).subscribe(res => {
      lastResult = res;
    });

    // 1st poll
    tick(4000);
    const req1 = httpMock.expectOne(`${baseUrl}/status/${jobId}`);
    req1.flush(statusSequence[0]);
    expect(lastResult?.status).toBe('pending');

    // 2nd poll
    tick(4000);
    const req2 = httpMock.expectOne(`${baseUrl}/status/${jobId}`);
    req2.flush(statusSequence[1]);
    expect(lastResult?.status).toBe('processing');

    // 3rd poll (final)
    tick(4000);
    const req3 = httpMock.expectOne(`${baseUrl}/status/${jobId}`);
    req3.flush(statusSequence[2]);
    expect(lastResult?.status).toBe('done');

    sub.unsubscribe();
  }));

  it('should stop polling on error', fakeAsync(() => {
    const jobId = 'job123';
    const errorJob: VideoJob = { jobId, status: 'error', avatarUrl: null, slideCount: 0, scriptTitle: null, error: 'Failed' };

    let results: VideoJob[] = [];
    const sub = service.pollStatus(jobId).subscribe(res => {
      results.push(res);
    });

    tick(4000);
    const req = httpMock.expectOne(`${baseUrl}/status/${jobId}`);
    req.flush(errorJob);

    expect(results.length).toBe(1);
    expect(results[0].status).toBe('error');

    // Ensure no more requests
    tick(4000);
    httpMock.expectNone(`${baseUrl}/status/${jobId}`);
    
    sub.unsubscribe();
  }));
});
