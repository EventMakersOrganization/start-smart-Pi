import { Body, Controller, Get, Param, Post, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { UsageService } from './usage.service';
import { ComparisonService } from './comparison.service';
import { PredictiveService, PredictiveUserData } from './predictive.service';
import {
  InterventionRiskLevel,
  InterventionService,
  InterventionUserData,
} from './intervention.service';
import { AbTestingService } from './ab-testing.service';
import { IntegrationService } from './integration.service';
import { InsightService } from './insight.service';

interface InterventionRequest {
  userData: InterventionUserData;
  riskLevel: InterventionRiskLevel;
}

interface AssignAbRequest {
  userId: string;
  interventions?: {
    A?: string;
    B?: string;
  };
}

interface TrackAbOutcomeRequest {
  userId: string;
  outcome?: string;
  result?: string;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly usageService: UsageService,
    private readonly comparisonService: ComparisonService,
    private readonly predictiveService: PredictiveService,
    private readonly interventionService: InterventionService,
    private readonly abTestingService: AbTestingService,
    private readonly integrationService: IntegrationService,
    private readonly insightService: InsightService,
  ) {}

  /**
   * Get dashboard summary data
   * Returns aggregated metrics for dashboard display
   * 
   * @returns {DashboardData} Total users, active users, high risk users, total alerts
   */
  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getDashboard() {
    return this.analyticsService.getDashboardData();
  }

  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getAnalyticsHealth() {
    return this.analyticsService.getAnalyticsHealth();
  }

  @Get('activity-by-hour')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getActivityByHour(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.analyticsService.getActivityByHour(start, end);
  }

  @Get('activity-channel-split')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getActivityChannelSplit() {
    return this.analyticsService.getActivityChannelSplit();
  }

  @Get('ai-events-feed')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getAiEventsFeed(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.analyticsService.getAiEventsFeed(limit ?? 20);
  }

  /**
   * Get risk score trends over time
   * Returns aggregated risk data grouped by date
   * 
   * @param days Number of days to look back (default: 30)
   * @returns {RiskTrendData[]} Array of daily risk statistics
   */
  @Get('risk-trends')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getRiskTrends(@Query('days', new ParseIntPipe({ optional: true })) days?: number) {
    return this.analyticsService.getRiskTrends(days || 30);
  }

  /**
   * Get recent alerts
   * Returns the most recent alerts sorted by creation date
   * 
   * @param limit Number of alerts to return (default: 10)
   * @returns {RecentAlertData[]} Array of recent alerts with populated user data
   */
  @Get('recent-alerts')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getRecentAlerts(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.analyticsService.getRecentAlerts(limit || 10);
  }

  /**
   * Get intervention tracking rows for instructor dashboard.
   */
  @Get('interventions')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getInterventions(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.analyticsService.getInterventions(limit || 200);
  }

  /**
   * Get usage analytics metrics built from activity data.
   * Shared endpoint, mainly consumed by admin dashboard.
   */
  @Get('usage')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getUsageAnalytics() {
    return this.usageService.getUsageAnalytics();
  }

  /**
   * Compare student performance against class average.
   * Optional classLevel query allows filtering to a specific class cohort.
   */
  @Get('comparison')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getComparisonAnalytics(@Query('classLevel') classLevel?: string) {
    return this.comparisonService.getComparativeAnalytics(classLevel);
  }

  /**
   * Return unified cross-module analytics for a single student.
   */
  @Get('unified/:userId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getUnifiedAnalytics(@Param('userId') userId: string) {
    return this.integrationService.getUnifiedStudentAnalytics(userId);
  }

  /**
   * Calculate a global engagement score for one student.
   */
  @Get('engagement/:userId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getEngagementScore(@Param('userId') userId: string) {
    return this.analyticsService.getStudentEngagementScore(userId);
  }

  /**
   * Analyze retention and dropout trends over time.
   */
  @Get('retention')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getRetentionAnalytics(@Query('days', new ParseIntPipe({ optional: true })) days?: number) {
    return this.analyticsService.getRetentionAnalytics(days || 30);
  }

  /**
   * Group students into cohorts and analyze behavior patterns.
   */
  @Get('cohorts')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getCohortAnalytics() {
    return this.analyticsService.getCohortAnalytics();
  }

  /**
   * Generate human-readable rule-based insights from analytics.
   */
  @Get('insights')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getInsights() {
    return this.insightService.generateInsights();
  }

  /**
   * Predict student dropout risk using rule-based factors.
   */
  @Post('predictive/dropout')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async predictDropoutRisk(@Body() userData: PredictiveUserData) {
    return this.predictiveService.predictDropoutRisk(userData);
  }

  /**
   * Generate instructor intervention suggestions based on risk and behavior.
   */
  @Post('intervention/suggestions')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async generateInterventionSuggestions(@Body() payload: InterventionRequest) {
    const prediction = this.predictiveService.predictDropoutRisk(payload.userData);
    return this.interventionService.generateInterventionSuggestions(
      payload.userData,
      payload.riskLevel,
      prediction,
    );
  }

  /**
   * Randomly assign a user to A/B intervention group and persist assignment.
   */
  @Post('ab-testing/assign')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async assignAbGroup(@Body() payload: AssignAbRequest) {
    return this.abTestingService.assignUserToGroup(payload.userId, payload.interventions);
  }

  /**
   * Track latest intervention outcome for the user.
   */
  @Post('ab-testing/outcome')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async trackAbOutcome(@Body() payload: TrackAbOutcomeRequest) {
    return this.abTestingService.trackOutcome(
      payload.userId,
      payload.outcome ?? payload.result ?? '',
    );
  }

  /**
   * Get user's persisted A/B assignment.
   */
  @Get('ab-testing/user/:userId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async getAbAssignmentByUser(@Param('userId') userId: string) {
    return this.abTestingService.getUserAssignment(userId);
  }

  /**
   * List recent A/B assignments.
   */
  @Get('ab-testing/assignments')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  async listAbAssignments(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.abTestingService.listAssignments(limit || 100);
  }
}
