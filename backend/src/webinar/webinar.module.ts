import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebinarController } from './webinar.controller';
import { WebinarService } from './webinar.service';
import { WebinarGateway } from './webinar.gateway';
import { Webinar, WebinarSchema } from './schemas/webinar.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Webinar.name, schema: WebinarSchema }]),
    ],
    controllers: [WebinarController],
    providers: [WebinarService, WebinarGateway],
    exports: [WebinarService],
})
export class WebinarModule { }
