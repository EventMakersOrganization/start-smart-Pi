import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReportDefinition, ReportDefinitionDocument } from './schemas/report-definition.schema';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ReportDefinitionService {
  constructor(
    @InjectModel(ReportDefinition.name)
    private readonly reportDefModel: Model<ReportDefinitionDocument>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async create(ownerId: string, dto: CreateReportDefinitionDto): Promise<ReportDefinitionDocument> {
    const doc = new this.reportDefModel({
      name: dto.name,
      ownerId: new Types.ObjectId(ownerId),
      metrics: dto.metrics || [],
      filters: dto.filters || {},
      format: dto.format || 'csv',
    });
    return doc.save();
  }

  async findAllForOwner(ownerId: string): Promise<ReportDefinitionDocument[]> {
    return this.reportDefModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findOne(id: string, ownerId: string): Promise<ReportDefinitionDocument> {
    const doc = await this.reportDefModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Report definition not found');
    }
    if (String(doc.ownerId) !== ownerId) {
      throw new ForbiddenException();
    }
    return doc;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateReportDefinitionDto,
  ): Promise<ReportDefinitionDocument> {
    await this.findOne(id, ownerId);
    const updated = await this.reportDefModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException();
    }
    return updated;
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.reportDefModel.findByIdAndDelete(id).exec();
  }

  /**
   * Build tabular rows for client-side CSV/XLSX export (v1 — no large server files).
   */
  async run(
    id: string,
    ownerId: string,
  ): Promise<{ rows: Record<string, unknown>[]; format: 'csv' | 'xlsx' }> {
    const def = await this.findOne(id, ownerId);
    const rows: Record<string, unknown>[] = [];

    for (const m of def.metrics || []) {
      if (m === 'dashboard') {
        const d = await this.analyticsService.getDashboardData();
        rows.push(
          { metric: 'totalUsers', value: d.totalUsers },
          { metric: 'activeUsers', value: d.activeUsers },
          { metric: 'highRiskUsers', value: d.highRiskUsers },
          { metric: 'totalAlerts', value: d.totalAlerts },
          { metric: 'totalUsersDeltaPct', value: d.totalUsersDeltaPct },
          { metric: 'activeUsersDeltaPct', value: d.activeUsersDeltaPct },
          { metric: 'highRiskUsersDeltaPct', value: d.highRiskUsersDeltaPct },
          { metric: 'totalAlertsDeltaPct', value: d.totalAlertsDeltaPct },
          { metric: 'averageRiskScore', value: d.averageRiskScore },
          { metric: 'aiDecisionsToday', value: d.aiDecisionsToday },
        );
      } else if (m === 'activity') {
        const a = await this.analyticsService.getActivityByHour();
        rows.push({
          metric: 'activityByHour',
          hourLabels: a.hourLabels.join(','),
          activityCounts: a.activityCounts.join(','),
          sessionCounts: a.sessionCounts.join(','),
        });
      } else if (m === 'channel') {
        const c = await this.analyticsService.getActivityChannelSplit();
        rows.push(
          { metric: 'webPct', value: c.webPct },
          { metric: 'mobilePct', value: c.mobilePct },
          { metric: 'unknownPct', value: c.unknownPct },
          { metric: 'channelTotal', value: c.total },
        );
      }
    }

    return { rows, format: def.format };
  }
}
