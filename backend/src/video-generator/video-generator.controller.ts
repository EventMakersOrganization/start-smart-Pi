import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { VideoGeneratorService } from './video-generator.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Controller('video-generator')
export class VideoGeneratorController {
    constructor(private readonly svc: VideoGeneratorService) { }

    /**
     * POST /video-generator/generate
     * Submit a course → avatar video job.
     * Body: { courseContent, language?, presenterUrl? }
     */
    @Post('generate')
    async generate(@Body() dto: GenerateVideoDto) {
        return this.svc.generateVideo(dto);
    }

    /**
     * GET /video-generator/status/:jobId
     * Poll job completion. Returns { status, avatarUrl, slideCount, ... }
     */
    @Get('status/:jobId')
    async status(@Param('jobId') jobId: string) {
        return this.svc.getStatus(jobId);
    }
}
