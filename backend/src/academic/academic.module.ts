import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { SchoolClass, SchoolClassSchema } from './schemas/school-class.schema';
import { ClassEnrollment, ClassEnrollmentSchema } from './schemas/class-enrollment.schema';
import { ClassSubject, ClassSubjectSchema } from './schemas/class-subject.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { StudentProfile, StudentProfileSchema } from '../users/schemas/student-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SchoolClass.name, schema: SchoolClassSchema }]),
    MongooseModule.forFeature([{ name: ClassEnrollment.name, schema: ClassEnrollmentSchema }]),
    MongooseModule.forFeature([{ name: ClassSubject.name, schema: ClassSubjectSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([{ name: Subject.name, schema: SubjectSchema }]),
    MongooseModule.forFeature([{ name: StudentProfile.name, schema: StudentProfileSchema }]),
  ],
  controllers: [AcademicController],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
