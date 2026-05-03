import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReportService } from './report.service';
import { Report } from './schemas/report.schema';
import { MonitoringService } from '../monitoring/monitoring.service';
import { UsageService } from '../analytics/usage.service';
import { RiskLevel, RiskScore } from '../analytics/schemas/riskscore.schema';

describe('ReportService', () => {
  let service: ReportService;
  let reportModel: any;
  let riskScoreModel: any;
  let monitoringService: any;
  let usageService: any;

  const reportModelMock = {
    findOneAndUpdate: jest.fn(),
  };

  const riskScoreModelMock = {
    aggregate: jest.fn(),
  };

  const monitoringServiceMock = {
    getSystemMetrics: jest.fn(),
  };

  const usageServiceMock = {
    getUsageAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    reportModelMock.findOneAndUpdate.mockReset();
    riskScoreModelMock.aggregate.mockReset();
    monitoringServiceMock.getSystemMetrics.mockReset();
    usageServiceMock.getUsageAnalytics.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getModelToken(Report.name), useValue: reportModelMock },
        { provide: getModelToken(RiskScore.name), useValue: riskScoreModelMock },
        { provide: MonitoringService, useValue: monitoringServiceMock },
        { provide: UsageService, useValue: usageServiceMock },
      ],
    }).compile();

    service = module.get(ReportService);
    reportModel = module.get(getModelToken(Report.name));
    riskScoreModel = module.get(getModelToken(RiskScore.name));
    monitoringService = module.get(MonitoringService);
    usageService = module.get(UsageService);
  });

  it('should create or update daily report using monitoring and usage metrics', async () => {
    monitoringService.getSystemMetrics.mockResolvedValue({
      totalUsers: 120,
      totalAlerts: 14,
    });
    usageService.getUsageAnalytics.mockResolvedValue({
      activeUsers: 37,
    });
    riskScoreModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ count: 6 }]),
    });
    reportModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        date: new Date('2026-05-03T00:00:00.000Z'),
        totalUsers: 120,
        activeUsers: 37,
        highRiskUsers: 6,
        alertsCount: 14,
      }),
    });

    const result = await service.createOrUpdateDailyReport(new Date('2026-05-03T13:15:00.000Z'));

    expect(reportModel.findOneAndUpdate).toHaveBeenCalled();
    expect(result.totalUsers).toBe(120);
    expect(result.activeUsers).toBe(37);
    expect(result.highRiskUsers).toBe(6);
    expect(result.alertsCount).toBe(14);
  });

  it('should return zero high risk users when aggregation is empty', async () => {
    monitoringService.getSystemMetrics.mockResolvedValue({
      totalUsers: 50,
      totalAlerts: 2,
    });
    usageService.getUsageAnalytics.mockResolvedValue({
      activeUsers: 15,
    });
    riskScoreModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    reportModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        date: new Date('2026-05-03T00:00:00.000Z'),
        totalUsers: 50,
        activeUsers: 15,
        highRiskUsers: 0,
        alertsCount: 2,
      }),
    });

    const result = await service.createOrUpdateDailyReport(new Date('2026-05-03T09:30:00.000Z'));

    expect(riskScoreModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ $match: { riskLevel: RiskLevel.HIGH } }),
      ]),
    );
    expect(result.highRiskUsers).toBe(0);
  });

  it('should call createOrUpdateDailyReport when generateDailyReport runs', async () => {
    const spy = jest
      .spyOn(service, 'createOrUpdateDailyReport')
      .mockResolvedValue({} as any);

    await service.generateDailyReport();

    expect(spy).toHaveBeenCalled();
  });
});
