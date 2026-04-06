import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { StudentProfile, StudentProfileSchema } from './schemas/student-profile.schema';
import { UsersController } from './users.controller';
import { AdminController } from '../admin/admin.controller';
import { UsersService } from './users.service';
import { ActivityModule } from '../activity/activity.module';
import { SubjectsModule } from '../subjects/subjects.module';

@Module({
  imports: [
    forwardRef(() => SubjectsModule),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: StudentProfile.name, schema: StudentProfileSchema },
    ]),
    ActivityModule,
  ],
  controllers: [UsersController, AdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
