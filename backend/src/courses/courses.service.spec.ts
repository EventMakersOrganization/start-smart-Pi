import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course } from './schemas/course.schema';
import { Subject } from '../subjects/schemas/subject.schema';
import { CourseIndexingService } from './course-indexing.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let courseModel: any;
  let subjectModel: any;
  let indexingService: any;

  const mockCourse = {
    _id: 'courseId',
    title: 'Test Course',
    level: '1st Year',
    instructorId: 'instructorId',
    subject: 'Test Subject',
    save: jest.fn(),
  };

  const mockCourseModel = jest.fn().mockImplementation(() => mockCourse);
  Object.assign(mockCourseModel, {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
  });

  // NestJS/Mongoose model mocking needs to handle the 'new Model()' pattern
  function MockModel(dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue({ _id: 'newId', ...dto });
    Object.assign(this, this.save); // for create()
  }

  const mockSubjectModel = {
    find: jest.fn(),
    exists: jest.fn(),
  };

  const mockIndexingService = {
    scheduleCourseReindex: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: getModelToken(Course.name),
          useValue: mockCourseModel,
        },
        {
          provide: getModelToken(Subject.name),
          useValue: mockSubjectModel,
        },
        {
          provide: CourseIndexingService,
          useValue: mockIndexingService,
        },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    courseModel = module.get(getModelToken(Course.name));
    subjectModel = module.get(getModelToken(Subject.name));
    indexingService = module.get(CourseIndexingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('happy path: should create a course and schedule reindexing', async () => {
      const dto = { title: 'New Course', instructorId: 'inst1' };
      
      // Mocking the 'new this.courseModel(dto)'
      const saveMock = jest.fn().mockResolvedValue({ _id: 'newId', ...dto });
      courseModel.mockImplementationOnce(() => ({
        ...dto,
        _id: 'newId',
        save: saveMock,
      }));

      const result = await service.create(dto as any) as any;

      expect(result._id).toBe('newId');
      expect(saveMock).toHaveBeenCalled();
      expect(indexingService.scheduleCourseReindex).toHaveBeenCalledWith('newId');
    });
  });

  describe('findOne', () => {
    it('happy path: should return a course if found', async () => {
      const mockExec = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCourse),
      };
      courseModel.findById.mockReturnValue(mockExec);

      const result = await service.findOne('courseId');
      expect(result).toEqual(mockCourse);
    });

    it('error path: should throw NotFoundException if not found', async () => {
      const mockExec = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      courseModel.findById.mockReturnValue(mockExec);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('happy path: should return paginated results', async () => {
      const mockList = [mockCourse];
      const mockExec = {
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockList),
      };
      courseModel.find.mockReturnValue(mockExec);
      courseModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll(1, 10);
      expect(result.data).toEqual(mockList);
      expect(result.total).toBe(1);
    });
  });

  describe('update', () => {
    it('happy path: should update and reindex', async () => {
      const dto = { title: 'Updated' };
      const mockExec = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockCourse, ...dto }),
      };
      courseModel.findByIdAndUpdate.mockReturnValue(mockExec);

      const result = await service.update('courseId', dto as any);
      expect(result.title).toBe('Updated');
      expect(indexingService.scheduleCourseReindex).toHaveBeenCalledWith('courseId');
    });

    it('edge case: should throw if course to update does not exist', async () => {
      const mockExec = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      courseModel.findByIdAndUpdate.mockReturnValue(mockExec);

      await expect(service.update('ghost', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('happy path: should delete a course', async () => {
      const mockExec = {
        exec: jest.fn().mockResolvedValue(true),
      };
      courseModel.findByIdAndDelete.mockReturnValue(mockExec);

      await service.remove('courseId');
      expect(courseModel.findByIdAndDelete).toHaveBeenCalledWith('courseId');
    });

    it('error path: should throw if course to delete does not exist', async () => {
      const mockExec = {
        exec: jest.fn().mockResolvedValue(null),
      };
      courseModel.findByIdAndDelete.mockReturnValue(mockExec);

      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
