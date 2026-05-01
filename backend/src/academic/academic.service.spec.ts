import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicService } from './academic.service';
import { SchoolClass } from './schemas/school-class.schema';
import { ClassEnrollment } from './schemas/class-enrollment.schema';
import { ClassSubject } from './schemas/class-subject.schema';
import { ClassInstructor } from './schemas/class-instructor.schema';
import { Attendance } from './schemas/attendance.schema';
import { User } from '../users/schemas/user.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { StudentProfile } from '../users/schemas/student-profile.schema';
import { Types } from 'mongoose';

describe('AcademicService', () => {
  let service: AcademicService;
  let schoolClassModel: any;

  const createMockModel = () => ({
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOneAndUpdate: jest.fn().mockReturnThis(),
    exists: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    create: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicService,
        { provide: getModelToken(SchoolClass.name), useValue: createMockModel() },
        { provide: getModelToken(ClassEnrollment.name), useValue: createMockModel() },
        { provide: getModelToken(ClassSubject.name), useValue: createMockModel() },
        { provide: getModelToken(ClassInstructor.name), useValue: createMockModel() },
        { provide: getModelToken(Attendance.name), useValue: createMockModel() },
        { provide: getModelToken(User.name), useValue: createMockModel() },
        { provide: getModelToken(Subject.name), useValue: createMockModel() },
        { provide: getModelToken(StudentProfile.name), useValue: createMockModel() },
      ],
    }).compile();

    service = module.get<AcademicService>(AcademicService);
    schoolClassModel = module.get(getModelToken(SchoolClass.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('happy path: should create a class', async () => {
      const dto = { name: 'Test Class', capacity: 30 };
      schoolClassModel.exists.mockResolvedValue(false); // For unique code generation
      schoolClassModel.create.mockResolvedValue({ _id: 'id', code: 'TEST', ...dto });
      
      // Mocking toResponse dependencies
      (service as any).getClassStudents = jest.fn().mockResolvedValue([]);
      (service as any).getClassSubjects = jest.fn().mockResolvedValue([]);
      (service as any).getClassInstructors = jest.fn().mockResolvedValue([]);

      const result = await service.create(dto as any);
      expect(result.name).toBe('Test Class');
      expect(schoolClassModel.create).toHaveBeenCalled();
    });

    it('error path: should throw BadRequestException if name is missing', async () => {
        await expect(service.create({ name: '' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
      it('happy path: should return a class if it exists', async () => {
          const mockClass = { _id: 'id', name: 'C1' };
          schoolClassModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockClass) });
          (service as any).toResponse = jest.fn().mockResolvedValue({ id: 'id', name: 'C1' });

          const result = await service.findOne('id');
          expect(result.name).toBe('C1');
      });

      it('error path: should throw NotFoundException if class not found', async () => {
          schoolClassModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
          await expect(service.findOne('id')).rejects.toThrow(NotFoundException);
      });
  });

  describe('enrollStudent', () => {
      it('edge case: should handle invalid student id', async () => {
          // findClassById is internal, let's mock the model call it makes
          schoolClassModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'cid' }) });
          // studentId check happens in findStudentById
          await expect(service.enrollStudent('cid', { studentId: 'invalid' })).rejects.toThrow(BadRequestException);
      });
  });
});
