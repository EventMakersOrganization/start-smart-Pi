import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Webinar, WebinarDocument } from './schemas/webinar.schema';
import { CreateWebinarDto } from './dto/create-webinar.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WebinarService {
    private readonly logger = new Logger(WebinarService.name);

    constructor(
        @InjectModel(Webinar.name) private webinarModel: Model<WebinarDocument>,
    ) { }

    async create(createWebinarDto: CreateWebinarDto): Promise<Webinar> {
        const createdWebinar = new this.webinarModel({
            ...createWebinarDto,
            scheduledStartTime: new Date(createWebinarDto.scheduledStartTime),
        });
        return createdWebinar.save();
    }

    async findAll(): Promise<Webinar[]> {
        return this.webinarModel.find().sort({ scheduledStartTime: 1 }).exec();
    }

    async findOne(id: string): Promise<Webinar> {
        return this.webinarModel.findById(id).exec();
    }

    async addParticipant(webinarId: string, participant: { userId: string; username: string }) {
        await this.webinarModel.updateOne(
            { _id: webinarId, 'participants.userId': { $ne: participant.userId } },
            { $push: { participants: participant } },
        );
    }

    async removeParticipant(webinarId: string, userId: string) {
        await this.webinarModel.updateOne(
            { _id: webinarId },
            { $pull: { participants: { userId } } },
        );
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleWebinarStatus() {
        this.logger.debug('Checking webinar statuses...');
        const now = new Date();

        // 1. Mark status as 'live' if it's scheduled and startTime has passed
        await this.webinarModel.updateMany(
            {
                status: 'scheduled',
                scheduledStartTime: { $lte: now },
            },
            { status: 'live' },
        );

        // 2. Mark status as 'ended' if duration has passed
        // We fetch live webinars to check their end time
        const liveWebinars = await this.webinarModel.find({ status: 'live' }).exec();

        for (const webinar of liveWebinars) {
            const endTime = new Date(webinar.scheduledStartTime.getTime() + webinar.durationMinutes * 60000);
            if (now >= endTime) {
                webinar.status = 'ended';
                await webinar.save();
                this.logger.log(`Webinar ${webinar.title} has ended.`);
            }
        }
    }
}
