import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { VideoGeneratorService } from './video-generator.service';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { of, throwError } from 'rxjs';

describe('VideoGeneratorService', () => {
  let service: VideoGeneratorService;
  let mockHttpService: any;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoGeneratorService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<VideoGeneratorService>(VideoGeneratorService);
  });

  describe('generateVideo', () => {
    it('should submit a video generation job successfully', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Introduction to Mathematics',
        language: 'en',
        presenterUrl: 'https://example.com/presenter.jpg',
      };

      const mockResponse = {
        data: {
          job_id: 'job-12345',
          status: 'queued',
        },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto);

      expect(result.jobId).toBe('job-12345');
      expect(result.status).toBe('queued');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/video/generate'),
        expect.any(FormData)
      );
    });

    it('should include course content in request', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Chapter 1: Basics',
        language: 'fr',
      };

      const mockResponse = {
        data: { job_id: 'job-123', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      await service.generateVideo(dto);

      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should include presenter image file in request', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
      };

      const mockFile = {
        buffer: Buffer.from('image-data'),
        mimetype: 'image/png',
        originalname: 'presenter.png',
      } as any;

      const mockResponse = {
        data: { job_id: 'job-456', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto, mockFile);

      expect(result).toBeDefined();
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should include course file in request', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
      };

      const mockCourseFile = {
        buffer: Buffer.from('course-data'),
        mimetype: 'application/pdf',
        originalname: 'course.pdf',
      } as any;

      const mockResponse = {
        data: { job_id: 'job-789', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto, undefined, mockCourseFile);

      expect(result).toBeDefined();
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should include both presenter image and course file', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Full content',
        language: 'es',
      };

      const presenterFile = {
        buffer: Buffer.from('image'),
        mimetype: 'image/jpg',
        originalname: 'presenter.jpg',
      } as any;

      const courseFile = {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        originalname: 'course.pdf',
      } as any;

      const mockResponse = {
        data: { job_id: 'job-full', status: 'processing' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto, presenterFile, courseFile);

      expect(result.jobId).toBe('job-full');
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle missing course content', async () => {
      const dto: GenerateVideoDto = {
        courseContent: '',
        language: 'en',
      };

      const mockResponse = {
        data: { job_id: 'job-empty', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto);

      expect(result).toBeDefined();
      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should handle missing presenter URL', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
        presenterUrl: undefined,
      };

      const mockResponse = {
        data: { job_id: 'job-no-url', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.generateVideo(dto);

      expect(result).toBeDefined();
    });

    it('should default language to "en"', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
      };

      const mockResponse = {
        data: { job_id: 'job-en', status: 'queued' },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(mockResponse));

      await service.generateVideo(dto);

      expect(mockHttpService.post).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    let errorLogSpy: jest.SpyInstance;

    beforeEach(() => {
      // getStatus logs Logger.error on handled HTTP failures; suppress noise in CI output.
      errorLogSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      errorLogSpy.mockRestore();
    });

    it('should retrieve job status successfully', async () => {
      const jobId = 'job-12345';

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'completed',
          avatar_url: 'https://example.com/avatar.mp4',
          slide_count: 10,
          script_title: 'Math Introduction',
          error: null,
          scenes: [{ id: 1, text: 'Scene 1' }],
          full_transcript: 'Complete transcript here',
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.jobId).toBe(jobId);
      expect(result.status).toBe('completed');
      expect(result.avatarUrl).toBe('https://example.com/avatar.mp4');
      expect(result.slideCount).toBe(10);
      expect(result.scriptTitle).toBe('Math Introduction');
    });

    it('should handle pending status', async () => {
      const jobId = 'job-pending';

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'processing',
          avatar_url: null,
          slide_count: 0,
          script_title: null,
          error: null,
          scenes: null,
          full_transcript: null,
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.status).toBe('processing');
      expect(result.avatarUrl).toBeNull();
      expect(result.slideCount).toBe(0);
    });

    it('should handle error status', async () => {
      const jobId = 'job-error';

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'error',
          avatar_url: null,
          slide_count: 0,
          script_title: null,
          error: 'Processing failed',
          scenes: null,
          full_transcript: null,
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Processing failed');
    });

    it('should return null values when fields are missing', async () => {
      const jobId = 'job-partial';

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'completed',
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.avatarUrl).toBeNull();
      expect(result.scriptTitle).toBeNull();
      expect(result.error).toBeNull();
      expect(result.scenes).toBeNull();
      expect(result.fullTranscript).toBeNull();
      expect(result.slideCount).toBe(0);
    });

    it('should handle HTTP error gracefully', async () => {
      const jobId = 'job-failed';

      mockHttpService.get = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('Network error')));

      const result = await service.getStatus(jobId);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Failed to reach AI service');
      expect(result.jobId).toBe(jobId);
      expect(result.avatarUrl).toBeNull();
    });

    it('should handle timeout errors', async () => {
      const jobId = 'job-timeout';

      const timeoutError = new Error('Request timeout');
      mockHttpService.get = jest
        .fn()
        .mockReturnValue(throwError(() => timeoutError));

      const result = await service.getStatus(jobId);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Failed to reach AI service');
    });

    it('should handle missing AI service', async () => {
      const jobId = 'job-no-service';

      const error = new Error('ECONNREFUSED');
      mockHttpService.get = jest.fn().mockReturnValue(throwError(() => error));

      const result = await service.getStatus(jobId);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Failed to reach AI service');
    });

    it('should extract nested data properties correctly', async () => {
      const jobId = 'job-nested';

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'completed',
          avatar_url: 'https://example.com/video.mp4',
          slide_count: 5,
          script_title: 'Advanced Math',
          error: null,
          scenes: [{ id: 1, title: 'Introduction' }],
          full_transcript: 'Full text',
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.jobId).toBe(jobId);
      expect(result.scriptTitle).toBe('Advanced Math');
      expect(result.fullTranscript).toBe('Full text');
      expect(result.scenes).toHaveLength(1);
    });

    it('should handle very large transcript', async () => {
      const jobId = 'job-large';
      const largeTranscript = 'A'.repeat(10000);

      const mockResponse = {
        data: {
          job_id: jobId,
          status: 'completed',
          avatar_url: 'https://example.com/video.mp4',
          slide_count: 100,
          script_title: 'Large Course',
          error: null,
          scenes: [],
          full_transcript: largeTranscript,
        },
      };

      mockHttpService.get = jest.fn().mockReturnValue(of(mockResponse));

      const result = await service.getStatus(jobId);

      expect(result.fullTranscript).toBe(largeTranscript);
      expect(result.fullTranscript.length).toBe(10000);
    });
  });

  describe('Integration scenarios', () => {
    it('should submit job and retrieve status in sequence', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Test Content',
        language: 'en',
      };

      const generateResponse = {
        data: { job_id: 'job-integration', status: 'queued' },
      };

      const statusResponse = {
        data: {
          job_id: 'job-integration',
          status: 'completed',
          avatar_url: 'https://example.com/result.mp4',
          slide_count: 8,
          script_title: 'Test Video',
          error: null,
          scenes: [],
          full_transcript: 'Transcript',
        },
      };

      mockHttpService.post = jest.fn().mockReturnValue(of(generateResponse));
      mockHttpService.get = jest.fn().mockReturnValue(of(statusResponse));

      const generateResult = await service.generateVideo(dto);
      expect(generateResult.jobId).toBe('job-integration');

      const statusResult = await service.getStatus(generateResult.jobId);
      expect(statusResult.status).toBe('completed');
    });

    it('should handle job submission failure', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
      };

      mockHttpService.post = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('Submission failed')));

      await expect(service.generateVideo(dto)).rejects.toThrow();
    });
  });

  describe('AI Service URL configuration', () => {
    it('should construct generate endpoint URL correctly', async () => {
      const dto: GenerateVideoDto = {
        courseContent: 'Content',
        language: 'en',
      };

      mockHttpService.post = jest
        .fn()
        .mockReturnValue(of({ data: { job_id: 'job-1', status: 'queued' } }));

      await service.generateVideo(dto);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/video/generate'),
        expect.any(FormData)
      );
    });

    it('should construct status endpoint URL correctly', async () => {
      const jobId = 'job-123';

      mockHttpService.get = jest.fn().mockReturnValue(
        of({
          data: {
            job_id: jobId,
            status: 'completed',
            avatar_url: 'https://example.com/video.mp4',
            slide_count: 5,
            script_title: 'Test',
            error: null,
            scenes: [],
            full_transcript: 'Text',
          },
        })
      );

      await service.getStatus(jobId);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/video/status/${jobId}`)
      );
    });
  });
});
