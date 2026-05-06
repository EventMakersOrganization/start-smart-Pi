import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AlertService } from './alert.service';
import { Alert, AlertSeverity } from './schemas/alert.schema';
import { RiskLevel } from './schemas/riskscore.schema';
import { EmailService } from '../notification/email.service';
import { User } from '../users/schemas/user.schema';

describe('AlertService', () => {
  let service: AlertService;
  let alertModel: any;
  let userModel: any;
  let emailService: any;

  const saveMock = jest.fn();
  const alertModelMock: any = jest.fn().mockImplementation((dto: any) => ({
    ...dto,
    save: saveMock,
  }));

  Object.assign(alertModelMock, {
    findOne: jest.fn(),
  });

  const userModelMock = {
    findById: jest.fn(),
  };

  const emailServiceMock = {
    sendHighRiskAlertEmail: jest.fn(),
  };

  beforeEach(async () => {
    saveMock.mockReset();
    alertModelMock.findOne.mockReset();
    userModelMock.findById.mockReset();
    emailServiceMock.sendHighRiskAlertEmail.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getModelToken(Alert.name), useValue: alertModelMock },
        { provide: getModelToken(User.name), useValue: userModelMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get(AlertService);
    alertModel = module.get(getModelToken(Alert.name));
    userModel = module.get(getModelToken(User.name));
    emailService = module.get(EmailService);
  });

  it('should skip duplicate unresolved risk alert for same user and trigger type', async () => {
    alertModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'existing-alert' }),
    });

    const result = await service.triggerRiskAlertIfNeeded({
      userId: new Types.ObjectId().toString(),
      riskScore: 84,
      riskLevel: RiskLevel.HIGH,
      message: 'High risk detected',
      triggerType: 'high-risk-threshold',
    });

    expect(result).toBeNull();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('should create high risk alert and notify user email when available', async () => {
    const userId = new Types.ObjectId();
    const savedAlert = {
      _id: 'new-alert',
      userId,
      student: userId,
      severity: AlertSeverity.HIGH,
      riskLevel: RiskLevel.HIGH,
      message: 'Escalated risk',
      timestamp: new Date('2026-05-01T10:00:00.000Z'),
    };

    alertModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    saveMock.mockResolvedValue(savedAlert);

    userModel.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ email: 'student@example.com' }),
    });

    const result = await service.triggerRiskAlertIfNeeded({
      userId: userId.toString(),
      riskScore: 92,
      riskLevel: RiskLevel.HIGH,
      message: 'Escalated risk',
      triggerType: 'high-risk-threshold',
    });

    expect(result).toEqual(savedAlert);
    expect(saveMock).toHaveBeenCalled();
    expect(emailService.sendHighRiskAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@example.com',
        alertMessage: 'Escalated risk',
      }),
    );
  });

  it('should throw NotFoundException for invalid user id on triggerRiskAlertIfNeeded', async () => {
    await expect(
      service.triggerRiskAlertIfNeeded({
        userId: 'invalid-user-id',
        riskScore: 40,
        riskLevel: RiskLevel.MEDIUM,
        message: 'Invalid id test',
        triggerType: 'suspicious-activity',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
