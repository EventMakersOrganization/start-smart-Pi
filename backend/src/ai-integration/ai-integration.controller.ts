import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AIIntegrationService } from './ai-integration.service';
import { SearchCoursesDto } from './dto/search-courses.dto';
import { GenerateQuestionDto } from './dto/generate-question.dto';
import { GenerateTestDto } from './dto/generate-test.dto';

@ApiTags('ai')
@Controller('ai')
export class AIIntegrationController {
  constructor(private readonly aiIntegrationService: AIIntegrationService) {}

  @Post('search')
  @ApiOperation({ summary: 'Semantic search over course content (proxies to AI service)' })
  @ApiResponse({ status: 200, description: 'Search results from AI service.' })
  @ApiResponse({ status: 502, description: 'AI service unavailable or error.' })
  async search(@Body() dto: SearchCoursesDto) {
    try {
      const nResults = dto.nResults ?? 5;
      return await this.aiIntegrationService.searchCourses(dto.query, nResults);
    } catch (error: any) {
      throw new HttpException(
        error?.message ?? 'AI search failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('generate-question')
  @ApiOperation({ summary: 'Generate a single question (preview, proxied to AI service)' })
  @ApiResponse({ status: 200, description: 'Generated question.' })
  @ApiResponse({ status: 502, description: 'AI service unavailable or error.' })
  async generateQuestion(@Body() dto: GenerateQuestionDto) {
    try {
      const topic = dto.topic ?? 'general';
      return await this.aiIntegrationService.generateQuestion(dto.subject, dto.difficulty, topic);
    } catch (error: any) {
      throw new HttpException(
        error?.message ?? 'AI generate-question failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('generate-test')
  @ApiOperation({ summary: 'Generate level test questions and save (proxied to AI service)' })
  @ApiResponse({ status: 200, description: 'Generated test with question IDs.' })
  @ApiResponse({ status: 502, description: 'AI service unavailable or error.' })
  async generateTest(@Body() dto: GenerateTestDto) {
    try {
      const difficulty = dto.difficulty ?? 'medium';
      return await this.aiIntegrationService.generateLevelTest(
        dto.subject,
        dto.numQuestions,
        difficulty,
      );
    } catch (error: any) {
      throw new HttpException(
        error?.message ?? 'AI generate-level-test failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('embed-courses')
  @ApiOperation({ summary: 'Trigger batch embedding of courses (proxied to AI service)' })
  @ApiResponse({ status: 200, description: 'Embedding job result.' })
  @ApiResponse({ status: 502, description: 'AI service unavailable or error.' })
  async embedCourses() {
    try {
      return await this.aiIntegrationService.embedAllCourses();
    } catch (error: any) {
      throw new HttpException(
        error?.message ?? 'AI embed-courses failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
