import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { KpiService } from './kpi.service';
import { User } from '../../users/schemas/user.schema';
import { Activity } from '../../activity/schemas/activity.schema';
import { RiskScore } from '../schemas/riskscore.schema';
import { Alert } from '../schemas/alert.schema';
import { AnalyticsReadCacheService } from './analytics-read-cache.service';

describe('KpiService', () => {
  let service: KpiService;
  let userModel: { countDocuments: jest.Mock };
  let activityModel: { distinct: jest.Mock };
  let riskScoreModel: { countDocuments: jest.Mock; aggregate: jest.Mock };
  let alertModel: { countDocuments: jest.Mock };

  const readCache = {
    getOrSet: jest.fn(async (_k: string, fn: () => Promise<any>) => fn()),
  };

  beforeEach(async () => {
    userModel = {
      countDocuments: jest.fn(),
    };
    activityModel = {
      distinct: jest.fn(),
    };
    riskScoreModel = {
      countDocuments: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: null, avg: 55 }]),
      }),
    };
    alertModel = {
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiService,
        { provide: AnalyticsReadCacheService, useValue: readCache },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Activity.name), useValue: activityModel },
        { provide: getModelToken(RiskScore.name), useValue: riskScoreModel },
        { provide: getModelToken(Alert.name), useValue: alertModel },
      ],
    }).compile();

    service = module.get(KpiService);
  });

  describe('getDashboardDeltas', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should compute percent deltas from windowed counts', async () => {
      activityModel.distinct
        .mockResolvedValueOnce(['a', 'b'])
        .mockResolvedValueOnce(['a']);

      userModel.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      alertModel.countDocuments.mockResolvedValueOnce(8).mockResolvedValueOnce(4);

      riskScoreModel.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

      const d = await service.getDashboardDeltas();

      expect(d.activeUsersDeltaPct).toBe(100);
      expect(d.totalUsersDeltaPct).toBe(100);
      expect(d.totalAlertsDeltaPct).toBe(100);
      expect(d.highRiskUsersDeltaPct).toBe(200);
    });

    it('should return null when both windows are zero for each metric', async () => {
      activityModel.distinct.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      userModel.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      alertModel.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      riskScoreModel.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const d = await service.getDashboardDeltas();

      expect(d.activeUsersDeltaPct).toBeNull();
      expect(d.totalUsersDeltaPct).toBeNull();
      expect(d.totalAlertsDeltaPct).toBeNull();
      expect(d.highRiskUsersDeltaPct).toBeNull();
    });
  });

  describe('getAverageRiskScorePercent', () => {
    it('should return rounded average from aggregation', async () => {
      riskScoreModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: null, avg: 42.7 }]),
      });

      const v = await service.getAverageRiskScorePercent();
      expect(v).toBe(43);
    });

    it('should return 0 when no scores', async () => {
      riskScoreModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const v = await service.getAverageRiskScorePercent();
      expect(v).toBe(0);
    });
  });
});
