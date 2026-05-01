import { MonitoringService } from './monitoring.service';

describe('MonitoringService (unit, member5)', () => {
  test('getSystemMetrics aggregates values from models', async () => {
    const userModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{ total: [{ count: 5 }], active: [{ count: 3 }] }] }) };
    const alertModel: any = { estimatedDocumentCount: jest.fn().mockReturnValue({ exec: async () => 7 }) };
    const riskScoreModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{ highRisk: [{ count: 2 }], average: [{ value: 4.75 }] }] }) };

    const svc = new MonitoringService(userModel as any, alertModel as any, riskScoreModel as any);
    const m = await svc.getSystemMetrics();
    expect(m.totalUsers).toBeDefined();
    expect(m.totalAlerts).toBe(7);
    expect(m.highRiskUsers).toBeDefined();
  });

  test('getSystemMetrics returns zeros when collections are empty', async () => {
    const userModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{}] }) };
    const alertModel: any = { estimatedDocumentCount: jest.fn().mockReturnValue({ exec: async () => 0 }) };
    const riskScoreModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{}] }) };

    const svc = new MonitoringService(userModel as any, alertModel as any, riskScoreModel as any);
    const m = await svc.getSystemMetrics();
    expect(m.totalUsers).toBe(0);
    expect(m.activeUsers).toBe(0);
    expect(m.totalAlerts).toBe(0);
    expect(m.highRiskUsers).toBe(0);
    expect(m.averageRiskScore).toBe(0);
  });

  test('getSystemMetrics rejects when a dependency fails', async () => {
    const userModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{ total: [{ count: 1 }], active: [{ count: 1 }] }] }) };
    const alertModel: any = { estimatedDocumentCount: jest.fn().mockReturnValue({ exec: async () => { throw new Error('down'); } }) };
    const riskScoreModel: any = { aggregate: jest.fn().mockReturnValue({ exec: async () => [{ highRisk: [{ count: 1 }], average: [{ value: 1 }] }] }) };

    const svc = new MonitoringService(userModel as any, alertModel as any, riskScoreModel as any);
    await expect(svc.getSystemMetrics()).rejects.toThrow('down');
  });
});
