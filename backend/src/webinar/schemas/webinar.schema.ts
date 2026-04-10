import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebinarDocument = Webinar & Document;

@Schema({ timestamps: true })
export class Webinar {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop()
    thumbnailUrl: string;

    @Prop({ required: true })
    instructorName: string;

    @Prop({ required: true })
    scheduledStartTime: Date;

    @Prop({ required: true })
    durationMinutes: number;

    @Prop({ default: 'scheduled' })
    status: 'scheduled' | 'live' | 'ended';

    @Prop({ type: [{ userId: String, username: String }], default: [] })
    participants: { userId: string; username: string }[];
}

export const WebinarSchema = SchemaFactory.createForClass(Webinar);
