import { Body, Controller, Get, Param, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideoGeneratorService } from './video-generator.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Controller('video-generator')
export class VideoGeneratorController {
    constructor(private readonly svc: VideoGeneratorService) { }

    @Post('generate')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'presenter_image', maxCount: 1 },
        { name: 'course_file', maxCount: 1 },
    ]))
    async generate(
        @Body() dto: GenerateVideoDto,
        @UploadedFiles() files: { presenter_image?: Express.Multer.File[], course_file?: Express.Multer.File[] }
    ) {
        const presenterImage = files.presenter_image?.[0];
        const courseFile = files.course_file?.[0];
        return this.svc.generateVideo(dto, presenterImage, courseFile);
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
