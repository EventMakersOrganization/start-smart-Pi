import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }]),
  ],
  providers: [ActivityService],
  exports: [ActivityService],
  controllers: [ActivityController],
})
export class ActivityModule {}
