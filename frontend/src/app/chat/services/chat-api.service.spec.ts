import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChatApiService } from './chat-api.service';

describe('ChatApiService', () => {
  let service: ChatApiService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:3000/api/chat';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatApiService]
    });
    service = TestBed.inject(ChatApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch sessions via GET', () => {
    const mockSessions = { rooms: [{ _id: '1', name: 'Room 1' }] };
    service.getSessions().subscribe(res => {
      expect(res).toEqual(mockSessions);
    });

    const req = httpMock.expectOne(`${apiUrl}/sessions`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSessions);
  });

  it('should fetch history via GET', () => {
    const mockHistory = [{ content: 'hello' }];
    service.getHistory('ChatRoom', '123').subscribe(res => {
      expect(res).toEqual(mockHistory);
    });

    const req = httpMock.expectOne(`${apiUrl}/history/ChatRoom/123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockHistory);
  });

  it('should create AI session via POST', () => {
    const mockRes = { _id: 'new-session' };
    service.createAiSession('Test Title').subscribe(res => {
      expect(res).toEqual(mockRes);
    });

    const req = httpMock.expectOne(`${apiUrl}/ai/session`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Test Title' });
    req.flush(mockRes);
  });

  it('should upload attachments via POST with FormData', () => {
    const mockFiles = [new File([''], 'file1.png')] as any;
    const mockRes = [{ url: 'path/to/file' }];
    
    service.uploadAttachments(mockFiles).subscribe(res => {
      expect(res).toEqual(mockRes);
    });

    const req = httpMock.expectOne(`${apiUrl}/upload-attachments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush(mockRes);
  });

  it('should get users by role with timestamp cache buster', () => {
    const role = 'student';
    service.getUsersByRole(role).subscribe();

    const req = httpMock.expectOne(request => 
      request.url.includes('/api/user') && 
      request.url.includes('role=' + role)
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should delete a room via DELETE', () => {
    service.deleteRoom('room123').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/room/room123`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
