import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AIIntegrationService {
  private readonly logger = new Logger(AIIntegrationService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    this.logger.log(`AI service URL: ${this.aiServiceUrl}`);
  }

  private getErrorMessage(error: any, fallback: string): string {
    if (error?.response?.data?.detail) return String(error.response.data.detail);
    if (error?.response?.data?.message) return String(error.response.data.message);
    if (error?.message && String(error.message).trim()) return String(error.message);
    if (error?.code) return `${fallback} (${error.code})`;
    return fallback;
  }

  async searchCourses(query: string, nResults: number = 5) {
    this.logger.log(`searchCourses: query="${query}", nResults=${nResults}`);
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/search`, {
          query,
          n_results: nResults,
        }),
      );
      this.logger.log(`searchCourses: received ${data?.results?.length ?? 0} results`);
      return data;
    } catch (error: any) {
      const message = this.getErrorMessage(error, 'AI service search failed');
      this.logger.error(`searchCourses failed: ${message}`);
      if (error?.code === 'ECONNREFUSED') {
        this.logger.error(`Ensure the Python AI service is running at ${this.aiServiceUrl}`);
      }
      throw new Error(message);
    }
  }

  async generateQuestion(subject: string, difficulty: string, topic: string) {
    this.logger.log(`generateQuestion: subject=${subject}, difficulty=${difficulty}, topic=${topic}`);
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/generate-question`, {
          subject,
          difficulty,
          topic,
        }),
      );
      this.logger.log('generateQuestion: success');
      return data;
    } catch (error: any) {
      const message = this.getErrorMessage(error, 'AI service generate-question failed');
      this.logger.error(`generateQuestion failed: ${message}`);
      throw new Error(message);
    }
  }

  async generateLevelTest(subject: string, numQuestions: number, difficulty: string) {
    this.logger.log(`generateLevelTest: subject=${subject}, numQuestions=${numQuestions}, difficulty=${difficulty}`);
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/generate-level-test`, {
          subject,
          num_questions: numQuestions,
          difficulty,
        }),
      );
      this.logger.log(`generateLevelTest: created ${data?.question_ids?.length ?? 0} questions`);
      return data;
    } catch (error: any) {
      const message = this.getErrorMessage(error, 'AI service generate-level-test failed');
      this.logger.error(`generateLevelTest failed: ${message}`);
      throw new Error(message);
    }
  }

  async embedAllCourses() {
    this.logger.log('embedAllCourses: calling batch-embed-courses');
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/batch-embed-courses`),
      );
      this.logger.log(`embedAllCourses: processed=${data?.courses_processed}, created=${data?.embeddings_created}`);
      return data;
    } catch (error: any) {
      const message = this.getErrorMessage(error, 'AI service batch-embed-courses failed');
      this.logger.error(`embedAllCourses failed: ${message}`);
      throw new Error(message);
    }
  }
}
