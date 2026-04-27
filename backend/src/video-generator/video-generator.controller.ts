import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideoGeneratorService } from './video-generator.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Controller('video-generator')
export class VideoGeneratorController {
    constructor(private readonly svc: VideoGeneratorService) { }

    @Post('generate')
    @UseInterceptors(FileInterceptor('presenter_image'))
    async generate(
        @Body() dto: GenerateVideoDto,
        @UploadedFile() file?: Express.Multer.File
    ) {
        return this.svc.generateVideo(dto, file);
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
