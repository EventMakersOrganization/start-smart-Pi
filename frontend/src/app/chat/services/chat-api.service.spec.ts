import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChatApiService } from './chat-api.service';

describe('ChatApiService (member5)', () => {
  let service: ChatApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [ChatApiService] });
    service = TestBed.inject(ChatApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getSessions calls API', () => {
    service.getSessions().subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/chat/sessions'));
    expect(req).toBeTruthy();
    req.flush({});
  });

  it('createAiSession posts the title payload', () => {
    service.createAiSession('My title').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/chat/ai/session'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'My title' });
    req.flush({ ok: true });
  });

  it('semanticSearch includes the default result size', () => {
    service.semanticSearch('loops').subscribe();
    const req = http.expectOne((r) => r.url.includes('/api/chat/ai/search'));
    expect(req.request.params.get('q')).toBe('loops');
    expect(req.request.params.get('n')).toBe('10');
    req.flush({ results: [] });
  });

  it('getSessions surfaces backend errors', () => {
    let errorResponse: any;
    service.getSessions().subscribe({ error: (err) => (errorResponse = err) });
    const req = http.expectOne((r) => r.url.includes('/api/chat/sessions'));
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    expect(errorResponse.status).toBe(500);
  });
});
