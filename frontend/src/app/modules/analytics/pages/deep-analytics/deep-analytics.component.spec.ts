import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { DeepAnalyticsComponent } from './deep-analytics.component';
import { RiskScoreService } from '../../services/riskscore.service';
import { AlertService } from '../../services/alert.service';
import { AuthService } from '../../../../user-management/auth.service';

describe('DeepAnalyticsComponent', () => {
  let component: DeepAnalyticsComponent;
  let fixture: ComponentFixture<DeepAnalyticsComponent>;
  let riskScoreService: jasmine.SpyObj<RiskScoreService>;
  let alertService: jasmine.SpyObj<AlertService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const riskSpy = jasmine.createSpyObj('RiskScoreService', ['getAllRiskScores']);
    const alertSpy = jasmine.createSpyObj('AlertService', ['getAllAlerts']);
    const authSpy = jasmine.createSpyObj('AuthService', ['getUser']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    authSpy.getUser.and.returnValue({
      first_name: 'Nora',
      last_name: 'Instructor',
      role: 'instructor',
    });

    riskSpy.getAllRiskScores.and.returnValue(
      of([
        { user: 'u1', score: 90, riskLevel: 'critical', lastUpdated: new Date() },
        { user: 'u2', score: 80, riskLevel: 'high', lastUpdated: new Date() },
        { user: 'u3', score: 55, riskLevel: 'medium', lastUpdated: new Date() },
        { user: 'u4', score: 20, riskLevel: 'low', lastUpdated: new Date() },
      ] as any),
    );

    alertSpy.getAllAlerts.and.returnValue(
      of([
        { message: 'A', severity: 'high', resolved: false, student: 'u1' },
        { message: 'B', severity: 'medium', resolved: true, student: 'u2' },
        { message: 'C', severity: 'low', resolved: false, student: 'u3' },
      ] as any),
    );

    await TestBed.configureTestingModule({
      declarations: [DeepAnalyticsComponent],
      providers: [
        { provide: RiskScoreService, useValue: riskSpy },
        { provide: AlertService, useValue: alertSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DeepAnalyticsComponent);
    component = fixture.componentInstance;
    riskScoreService = TestBed.inject(RiskScoreService) as jasmine.SpyObj<RiskScoreService>;
    alertService = TestBed.inject(AlertService) as jasmine.SpyObj<AlertService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(authService.getUser).toHaveBeenCalled();
  });

  it('should aggregate risk and alert metrics on init', () => {
    fixture.detectChanges();

    expect(riskScoreService.getAllRiskScores).toHaveBeenCalled();
    expect(alertService.getAllAlerts).toHaveBeenCalled();
    expect(component.totalStudents).toBe(4);
    expect(component.criticalRiskStudents).toBe(1);
    expect(component.highRiskStudents).toBe(1);
    expect(component.mediumRiskStudents).toBe(1);
    expect(component.lowRiskStudents).toBe(1);

    expect(component.totalAlerts).toBe(3);
    expect(component.highSeverityAlerts).toBe(1);
    expect(component.mediumSeverityAlerts).toBe(1);
    expect(component.lowSeverityAlerts).toBe(1);
    expect(component.unresolvedAlerts).toBe(2);
    expect(component.resolvedAlerts).toBe(1);
    expect(component.loading).toBeFalse();
    expect(component.error).toBeNull();
  });

  it('should map unauthorized-style error to session-expired display text', () => {
    fixture.detectChanges();

    component.error = '401 Unauthorized';
    expect(component.displayError).toBe('Session expired. Please log in again.');
  });

  it('should navigate to profile', () => {
    fixture.detectChanges();

    component.navigateToProfile();

    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });
});
