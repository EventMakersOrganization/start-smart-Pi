import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { Course } from '../courses/schemas/course.schema';
import { Exercise } from '../exercises/schemas/exercise.schema';
import { CourseUploadAsset } from './schemas/course-upload-asset.schema';
import { PrositQuizAsset } from './schemas/prosit-quiz-asset.schema';
import { ResourceAddAsset } from './schemas/resource-add-asset.schema';
import { VideoAsset } from './schemas/video-asset.schema';
import { Subject } from './schemas/subject.schema';
import { QuizSubmission } from './schemas/quiz-submission.schema';
import { QuizFileSubmission } from './schemas/quiz-file-submission.schema';
import { User } from '../users/schemas/user.schema';
import { ClassEnrollment } from '../academic/schemas/class-enrollment.schema';
import { ClassSubject } from '../academic/schemas/class-subject.schema';
import { CourseIndexingService } from '../courses/course-indexing.service';
import { Types } from 'mongoose';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let subjectModel: any;
  let enrollmentModel: any;
  let classSubjectModel: any;

  const mockSubject = {
    _id: new Types.ObjectId(),
    title: 'Test Subject',
    instructors: [new Types.ObjectId()],
  };

  const createMockModel = () => ({
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    exists: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    create: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: CourseIndexingService, useValue: { scheduleCourseReindex: jest.fn() } },
        { provide: getModelToken(Course.name), useValue: createMockModel() },
        { provide: getModelToken(Exercise.name), useValue: createMockModel() },
        { provide: getModelToken(CourseUploadAsset.name), useValue: createMockModel() },
        { provide: getModelToken(PrositQuizAsset.name), useValue: createMockModel() },
        { provide: getModelToken(ResourceAddAsset.name), useValue: createMockModel() },
        { provide: getModelToken(VideoAsset.name), useValue: createMockModel() },
        { provide: getModelToken(Subject.name), useValue: createMockModel() },
        { provide: getModelToken(QuizSubmission.name), useValue: createMockModel() },
        { provide: getModelToken(QuizFileSubmission.name), useValue: createMockModel() },
        { provide: getModelToken(User.name), useValue: createMockModel() },
        { provide: getModelToken(ClassEnrollment.name), useValue: createMockModel() },
        { provide: getModelToken(ClassSubject.name), useValue: createMockModel() },
      ],
    }).compile();

    service = module.get<SubjectsService>(SubjectsService);
    subjectModel = module.get(getModelToken(Subject.name));
    enrollmentModel = module.get(getModelToken(ClassEnrollment.name));
    classSubjectModel = module.get(getModelToken(ClassSubject.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureStudentHasSubjectAccess', () => {
    it('happy path: should do nothing if access is valid', async () => {
      const studentId = new Types.ObjectId().toHexString();
      const subjectId = new Types.ObjectId().toHexString();

      enrollmentModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ schoolClassId: 'class1' }) });
      classSubjectModel.exists.mockReturnValue({ exec: jest.fn().mockResolvedValue(true) });

      await expect(service.ensureStudentHasSubjectAccess(studentId, subjectId)).resolves.not.toThrow();
    });

    it('error path: should throw ForbiddenException if not enrolled', async () => {
        const studentId = new Types.ObjectId().toHexString();
        enrollmentModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
        await expect(service.ensureStudentHasSubjectAccess(studentId, new Types.ObjectId().toHexString())).rejects.toThrow(ForbiddenException);
    });

    it('edge case: should throw NotFoundException for invalid subjectId', async () => {
        await expect(service.ensureStudentHasSubjectAccess('s1', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
      it('happy path: should return subjects for student', async () => {
          const studentId = new Types.ObjectId().toHexString();
          enrollmentModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ schoolClassId: 'class1' }) });
          classSubjectModel.find.mockReturnValue({ 
              select: jest.fn().mockReturnThis(), 
              lean: jest.fn().mockReturnThis(), 
              exec: jest.fn().mockResolvedValue([{ subjectId: mockSubject._id }]) 
          });
          subjectModel.find.mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([mockSubject])
          });

          // Mocking private methods is hard, so we test the result of the public flow
          // Note: toResponse is private and uses more mocks internally
          // But we can verify if the main models were called
          const result = await (service as any).findAllForEnrolledStudent(studentId);
          expect(enrollmentModel.findOne).toHaveBeenCalled();
          expect(subjectModel.find).toHaveBeenCalled();
      });
  });
});
