import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnalyticsWebhookDocument = AnalyticsWebhook & Document;

@Schema({ timestamps: true, collection: 'analytics_webhooks' })
export class AnalyticsWebhook {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  /** Shared secret for HMAC-SHA256 body signatures (store securely in production). */
  @Prop({ required: true })
  secret: string;

  @Prop({ type: [String], default: ['analytics.summary'] })
  events: string[];

  @Prop({ default: true })
  enabled: boolean;
}

export const AnalyticsWebhookSchema = SchemaFactory.createForClass(AnalyticsWebhook);
