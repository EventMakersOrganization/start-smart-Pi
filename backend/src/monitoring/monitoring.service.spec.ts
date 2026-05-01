import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MonitoringService, SystemMonitoringMetrics } from './monitoring.service';
import { User, UserStatus } from '../users/schemas/user.schema';
import { Alert } from '../analytics/schemas/alert.schema';
import { RiskScore, RiskLevel } from '../analytics/schemas/riskscore.schema';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockUserModel: any;
  let mockAlertModel: any;
  let mockRiskScoreModel: any;

  beforeEach(async () => {
    mockUserModel = {
      aggregate: jest.fn(),
      estimatedDocumentCount: jest.fn(),
    };

    mockAlertModel = {
      estimatedDocumentCount: jest.fn(),
    };

    mockRiskScoreModel = {
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Alert.name), useValue: mockAlertModel },
        { provide: getModelToken(RiskScore.name), useValue: mockRiskScoreModel },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics with all components', async () => {
      const mockUserAggResult = [
        {
          total: [{ count: 100 }],
          active: [{ count: 75 }],
        },
      ];

      const mockRiskAggResult = [
        {
          highRisk: [{ count: 12 }],
          average: [{ value: 45.5 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserAggResult),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(234),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRiskAggResult),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(75);
      expect(result.totalAlerts).toBe(234);
      expect(result.highRiskUsers).toBe(12);
      expect(result.averageRiskScore).toBe(45.5);
    });

    it('should return zero values when no data exists', async () => {
      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(0);
      expect(result.totalAlerts).toBe(0);
      expect(result.highRiskUsers).toBe(0);
      expect(result.averageRiskScore).toBe(0);
    });

    it('should return metrics when only partial data exists', async () => {
      const mockUserAggResult = [
        {
          total: [{ count: 50 }],
          active: [],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserAggResult),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(10),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [], average: [] }]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(50);
      expect(result.activeUsers).toBe(0);
      expect(result.totalAlerts).toBe(10);
    });

    it('should execute all queries in parallel', async () => {
      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [{ count: 100 }], active: [{ count: 75 }] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(20),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [{ count: 5 }], average: [{ value: 50 }] }]),
      });

      await service.getSystemMetrics();

      expect(mockUserModel.aggregate).toHaveBeenCalled();
      expect(mockAlertModel.estimatedDocumentCount).toHaveBeenCalled();
      expect(mockRiskScoreModel.aggregate).toHaveBeenCalled();
    });
  });

  describe('getUserStats (private method via getSystemMetrics)', () => {
    it('should count total and active users correctly', async () => {
      const mockAggResult = [
        {
          total: [{ count: 200 }],
          active: [{ count: 150 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [], average: [] }]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(200);
      expect(result.activeUsers).toBe(150);
    });

    it('should handle missing count fields in aggregation result', async () => {
      const mockAggResult = [
        {
          total: [],
          active: [{ count: 75 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [], average: [] }]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(75);
    });
  });

  describe('getRiskStats (private method via getSystemMetrics)', () => {
    it('should calculate high risk users and average risk score', async () => {
      const mockAggResult = [
        {
          highRisk: [{ count: 25 }],
          average: [{ value: 62.75 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [{ count: 100 }], active: [] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      const result = await service.getSystemMetrics();

      expect(result.highRiskUsers).toBe(25);
      expect(result.averageRiskScore).toBe(62.75);
    });

    it('should round average risk score to 2 decimal places', async () => {
      const mockAggResult = [
        {
          highRisk: [],
          average: [{ value: 45.6789 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [], active: [] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      const result = await service.getSystemMetrics();

      expect(result.averageRiskScore).toBe(45.68);
    });

    it('should handle missing high risk count', async () => {
      const mockAggResult = [
        {
          highRisk: [],
          average: [{ value: 50 }],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [], active: [] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      const result = await service.getSystemMetrics();

      expect(result.highRiskUsers).toBe(0);
    });

    it('should handle missing average score', async () => {
      const mockAggResult = [
        {
          highRisk: [{ count: 10 }],
          average: [],
        },
      ];

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [], active: [] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggResult),
      });

      const result = await service.getSystemMetrics();

      expect(result.averageRiskScore).toBe(0);
    });

    it('should handle facet aggregation returning empty object', async () => {
      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(0);
      expect(result.highRiskUsers).toBe(0);
      expect(result.averageRiskScore).toBe(0);
    });
  });

  describe('SystemMonitoringMetrics structure', () => {
    it('should have all required properties', async () => {
      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [{ count: 10 }], active: [{ count: 8 }] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [{ count: 2 }], average: [{ value: 30 }] }]),
      });

      const result = await service.getSystemMetrics();

      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('activeUsers');
      expect(result).toHaveProperty('totalAlerts');
      expect(result).toHaveProperty('highRiskUsers');
      expect(result).toHaveProperty('averageRiskScore');

      expect(typeof result.totalUsers).toBe('number');
      expect(typeof result.activeUsers).toBe('number');
      expect(typeof result.totalAlerts).toBe('number');
      expect(typeof result.highRiskUsers).toBe('number');
      expect(typeof result.averageRiskScore).toBe('number');
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle very large numbers', async () => {
      const largeCount = 1000000;

      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            total: [{ count: largeCount }],
            active: [{ count: largeCount / 2 }],
          },
        ]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(largeCount / 10),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            highRisk: [{ count: largeCount / 100 }],
            average: [{ value: 50.123456 }],
          },
        ]),
      });

      const result = await service.getSystemMetrics();

      expect(result.totalUsers).toBe(largeCount);
      expect(result.activeUsers).toBe(largeCount / 2);
      expect(result.averageRiskScore).toBe(50.12);
    });

    it('should handle zero average risk score', async () => {
      mockUserModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ total: [], active: [] }]),
      });

      mockAlertModel.estimatedDocumentCount = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockRiskScoreModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ highRisk: [], average: [{ value: 0 }] }]),
      });

      const result = await service.getSystemMetrics();

      expect(result.averageRiskScore).toBe(0);
    });
  });
});
