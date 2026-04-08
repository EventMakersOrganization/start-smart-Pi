import { Component, OnInit } from '@angular/core';
import { ReportDefinitionApiService, ReportDefinitionItem } from '../../services/report-definition-api.service';
import { AnalyticsWebhookApiService, AnalyticsWebhookItem } from '../../services/analytics-webhook-api.service';
import { ExportService } from '../../services/export.service';

@Component({
  selector: 'app-report-builder',
  templateUrl: './report-builder.component.html',
  styleUrls: ['./report-builder.component.css'],
})
export class ReportBuilderComponent implements OnInit {
  loading = true;
  error: string | null = null;

  definitions: ReportDefinitionItem[] = [];
  webhooks: AnalyticsWebhookItem[] = [];

  reportName = 'My KPI export';
  selectedMetrics: string[] = ['dashboard'];
  format: 'csv' | 'xlsx' = 'csv';

  webhookName = 'Integration';
  webhookUrl = 'https://example.com/hook';
  webhookSecret = '';

  runPreview: Record<string, unknown>[] | null = null;

  readonly metricOptions = [
    { id: 'dashboard', label: 'Dashboard KPIs' },
    { id: 'activity', label: 'Activity by hour (summary row)' },
    { id: 'channel', label: 'Channel split' },
  ];

  constructor(
    private readonly reportApi: ReportDefinitionApiService,
    private readonly webhookApi: AnalyticsWebhookApiService,
    private readonly exportService: ExportService,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    this.reportApi.list().subscribe({
      next: (defs) => {
        this.definitions = defs;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load report definitions.';
        this.loading = false;
      },
    });
    this.webhookApi.list().subscribe({
      next: (w) => (this.webhooks = w),
      error: () => undefined,
    });
  }

  toggleMetric(id: string): void {
    const set = new Set(this.selectedMetrics);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedMetrics = [...set];
  }

  saveReport(): void {
    if (!this.reportName.trim() || this.selectedMetrics.length === 0) {
      return;
    }
    this.reportApi
      .create({
        name: this.reportName.trim(),
        metrics: this.selectedMetrics,
        format: this.format,
      })
      .subscribe({
        next: () => this.refresh(),
        error: () => (this.error = 'Save failed.'),
      });
  }

  runReport(id: string): void {
    this.reportApi.run(id).subscribe({
      next: (res) => {
        this.runPreview = res.rows;
        const name = `report-${id}`;
        if (res.format === 'xlsx') {
          this.exportService.exportToExcel(res.rows as Record<string, unknown>[], name);
        } else {
          this.exportService.exportToCSV(res.rows as Record<string, unknown>[], name);
        }
      },
      error: () => (this.error = 'Run failed.'),
    });
  }

  deleteReport(id: string): void {
    this.reportApi.remove(id).subscribe({ next: () => this.refresh() });
  }

  addWebhook(): void {
    if (!this.webhookName.trim() || !this.webhookUrl.trim() || !this.webhookSecret.trim()) {
      return;
    }
    this.webhookApi
      .create({
        name: this.webhookName.trim(),
        url: this.webhookUrl.trim(),
        secret: this.webhookSecret,
      })
      .subscribe({
        next: () => {
          this.webhookSecret = '';
          this.webhookApi.list().subscribe((w) => (this.webhooks = w));
        },
        error: () => (this.error = 'Webhook create failed.'),
      });
  }

  deleteWebhook(id: string): void {
    this.webhookApi.remove(id).subscribe({
      next: () => this.webhookApi.list().subscribe((w) => (this.webhooks = w)),
    });
  }

  testWebhook(id: string): void {
    this.webhookApi.test(id).subscribe({
      next: (r) => {
        if (!r.ok) {
          this.error = r.error || 'Test failed';
        }
      },
      error: () => (this.error = 'Test request failed.'),
    });
  }
}
