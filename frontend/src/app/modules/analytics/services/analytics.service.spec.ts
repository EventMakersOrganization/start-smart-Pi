import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AnalyticsService],
    });

    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request dashboard data from analytics API', () => {
    service.getDashboardData().subscribe((data) => {
      expect(data.totalUsers).toBe(42);
      expect(data.activeUsers).toBe(12);
    });

    const req = httpMock.expectOne('http://localhost:3000/api/analytics/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({
      totalUsers: 42,
      activeUsers: 12,
      highRiskUsers: 4,
      totalAlerts: 8,
      totalUsersDeltaPct: 10,
      activeUsersDeltaPct: 5,
      highRiskUsersDeltaPct: 0,
      totalAlertsDeltaPct: -5,
      averageRiskScore: 44,
      aiDecisionsToday: 7,
    });
  });

  it('should reuse shared observable for getDashboardData', () => {
    let first: any;
    let second: any;

    service.getDashboardData().subscribe((data) => {
      first = data;
    });
    service.getDashboardData().subscribe((data) => {
      second = data;
    });

    const req = httpMock.expectOne('http://localhost:3000/api/analytics/dashboard');
    req.flush({
      totalUsers: 10,
      activeUsers: 3,
      highRiskUsers: 1,
      totalAlerts: 2,
      totalUsersDeltaPct: null,
      activeUsersDeltaPct: null,
      highRiskUsersDeltaPct: null,
      totalAlertsDeltaPct: null,
      averageRiskScore: 20,
      aiDecisionsToday: 1,
    });

    expect(first.totalUsers).toBe(10);
    expect(second.totalUsers).toBe(10);
  });

  it('should clear memoized cache and issue a fresh request', () => {
    let secondTotal = 0;

    service.getDashboardData().subscribe();
    const firstReq = httpMock.expectOne('http://localhost:3000/api/analytics/dashboard');
    firstReq.flush({
      totalUsers: 1,
      activeUsers: 1,
      highRiskUsers: 0,
      totalAlerts: 0,
      totalUsersDeltaPct: null,
      activeUsersDeltaPct: null,
      highRiskUsersDeltaPct: null,
      totalAlertsDeltaPct: null,
      averageRiskScore: 0,
      aiDecisionsToday: 0,
    });

    service.clearSharedAnalyticsCache();

    service.getDashboardData().subscribe((data) => {
      secondTotal = data.totalUsers;
    });
    const secondReq = httpMock.expectOne('http://localhost:3000/api/analytics/dashboard');
    secondReq.flush({
      totalUsers: 2,
      activeUsers: 1,
      highRiskUsers: 0,
      totalAlerts: 0,
      totalUsersDeltaPct: null,
      activeUsersDeltaPct: null,
      highRiskUsersDeltaPct: null,
      totalAlertsDeltaPct: null,
      averageRiskScore: 0,
      aiDecisionsToday: 0,
    });

    expect(secondTotal).toBe(2);
  });
});
