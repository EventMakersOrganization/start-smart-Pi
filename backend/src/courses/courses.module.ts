import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Course, CourseSchema } from './schemas/course.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseIndexingService } from './course-indexing.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Course.name, schema: CourseSchema },
            { name: Subject.name, schema: SubjectSchema },
        ]),
        HttpModule.register({
            timeout: 620_000,
            maxRedirects: 0,
        }),
        forwardRef(() => AuthModule),
    ],
    controllers: [CoursesController],
    providers: [CoursesService, CourseIndexingService],
    exports: [CoursesService, CourseIndexingService],
})
export class CoursesModule { }
