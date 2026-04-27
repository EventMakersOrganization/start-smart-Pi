import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VideoGeneratorController } from './video-generator.controller';
import { VideoGeneratorService } from './video-generator.service';

@Module({
    imports: [HttpModule],
    controllers: [VideoGeneratorController],
    providers: [VideoGeneratorService],
    exports: [VideoGeneratorService],
})
export class VideoGeneratorModule { }
