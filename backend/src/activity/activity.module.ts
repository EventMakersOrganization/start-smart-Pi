import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Activity, ActivitySchema } from "./schemas/activity.schema";
import { UserSession, UserSessionSchema } from "./schemas/user-session.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { ActivityService } from "./activity.service";
import { SessionService } from "./session.service";
import { ActivityController } from "./activity.controller";
import { TrackingController } from "./tracking.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: UserSession.name, schema: UserSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ActivityService, SessionService],
  exports: [ActivityService, SessionService],
  controllers: [ActivityController, TrackingController],
})
export class ActivityModule {}
