import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHmac } from 'crypto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  AnalyticsWebhook,
  AnalyticsWebhookDocument,
} from './schemas/analytics-webhook.schema';
import { CreateAnalyticsWebhookDto } from './dto/create-analytics-webhook.dto';

@Injectable()
export class AnalyticsWebhookService {
  constructor(
    @InjectModel(AnalyticsWebhook.name)
    private readonly webhookModel: Model<AnalyticsWebhookDocument>,
    private readonly httpService: HttpService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateAnalyticsWebhookDto,
  ): Promise<AnalyticsWebhookDocument> {
    const doc = new this.webhookModel({
      name: dto.name,
      ownerId: new Types.ObjectId(ownerId),
      url: dto.url,
      secret: dto.secret,
      events: dto.events?.length ? dto.events : ['analytics.summary'],
    });
    return doc.save();
  }

  async findAllForOwner(ownerId: string): Promise<AnalyticsWebhookDocument[]> {
    return this.webhookModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .select('-secret')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const doc = await this.webhookModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException();
    }
    if (String(doc.ownerId) !== ownerId) {
      throw new ForbiddenException();
    }
    await this.webhookModel.findByIdAndDelete(id).exec();
  }

  async testPing(id: string, ownerId: string): Promise<{ ok: boolean; error?: string }> {
    const doc = await this.webhookModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException();
    }
    if (String(doc.ownerId) !== ownerId) {
      throw new ForbiddenException();
    }
    const body = JSON.stringify({
      event: 'test',
      at: new Date().toISOString(),
    });
    const sig = createHmac('sha256', doc.secret).update(body).digest('hex');
    try {
      await firstValueFrom(
        this.httpService.post(doc.url, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-StartSmart-Signature': sig,
          },
          timeout: 15000,
          validateStatus: () => true,
        }),
      );
      return { ok: true };
    } catch (e: unknown) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
