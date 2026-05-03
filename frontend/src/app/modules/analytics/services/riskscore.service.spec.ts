import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RiskScoreService } from './riskscore.service';

describe('RiskScoreService', () => {
  let service: RiskScoreService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RiskScoreService],
    });

    service = TestBed.inject(RiskScoreService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all risk scores', () => {
    service.getAllRiskScores().subscribe((rows) => {
      expect(rows.length).toBe(1);
      expect(rows[0].score).toBe(77);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/riskscores');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        _id: 'r1',
        user: 'u1',
        score: 77,
        riskLevel: 'high',
        lastUpdated: new Date().toISOString(),
      },
    ]);
  });

  it('should post recalculate request with optional limit', () => {
    service.recalculateRiskScores(25).subscribe((summary) => {
      expect(summary.processedStudents).toBe(25);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/riskscores/recalculate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.limit).toBe(25);
    req.flush({
      processedStudents: 25,
      updatedScores: 12,
      highRiskCount: 3,
      mediumRiskCount: 5,
      generatedAt: new Date().toISOString(),
      errors: [],
    });
  });

  it('should fetch at-risk insights with query parameters', () => {
    service.getAtRiskInsights('medium', 10).subscribe((rows) => {
      expect(rows.length).toBe(1);
      expect(rows[0].riskLevel).toBe('medium');
    });

    const req = httpMock.expectOne(
      'http://localhost:3000/api/riskscores/at-risk-insights?level=medium&limit=10',
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        userId: 'u1',
        name: 'Learner A',
        email: 'a@example.com',
        riskScore: 62,
        riskLevel: 'medium',
        weakAreas: [],
        weakSubskills: [],
        recommendedFocus: [],
        lastUpdated: null,
      },
    ]);
  });
});
