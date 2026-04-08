import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { Alert, AlertSchema } from './schemas/alert.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmailService } from '../notification/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Alert.name, schema: AlertSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AlertController],
  providers: [AlertService, EmailService],
  exports: [AlertService],
})
export class AlertModule {}
