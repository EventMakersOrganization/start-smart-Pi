import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ActivityService } from "./activity.service";
import { LogActivityDto } from "./dto/log-activity.dto";
import { classifyChannelFromHeaders } from "./activity.service";
import { ActivityAction } from "./schemas/activity.schema";
import { SessionService } from "./session.service";

@ApiTags("tracking")
@Controller("tracking")
export class TrackingController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly sessionService: SessionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Get current user activity trace" })
  async getMyTrace(
    @Req() req: any,
    @Query("limit") limit?: string,
    @Query("action") action?: ActivityAction,
    @Query("resourceType") resourceType?: string,
  ) {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    if (!userId) {
      return { status: "error", message: "Authenticated user not found" };
    }

    const events = await this.activityService.getUserActivities(userId, {
      limit: Number(limit || 200),
      action,
      resourceType,
    });

    return {
      status: "success",
      count: events.length,
      events,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post("event")
  @ApiOperation({ summary: "Record a student activity event for traceability" })
  async logEvent(@Req() req: any, @Body() body: LogActivityDto) {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    if (!userId) {
      return { status: "error", message: "Authenticated user not found" };
    }

    const channel = classifyChannelFromHeaders(
      req.headers["user-agent"],
      req.headers["x-client-channel"],
    );

    await this.activityService.logActivity(userId, body.action, {
      channel,
      pagePath: body.page_path,
      resourceType: body.resource_type,
      resourceId: body.resource_id,
      resourceTitle: body.resource_title,
      durationSec: body.duration_sec,
      metadata: body.metadata || {},
    });

    return { status: "success" };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post("heartbeat")
  @ApiOperation({ summary: "Keep current user session online" })
  async heartbeat(@Req() req: any) {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    if (!userId) {
      return { status: "error", message: "Authenticated user not found" };
    }

    const channel = classifyChannelFromHeaders(
      req.headers["user-agent"],
      req.headers["x-client-channel"],
    );
    await this.sessionService.touchSession(userId, {
      action: ActivityAction.PAGE_VIEW,
      channel,
      at: new Date(),
    });
    return { status: "success" };
  }
}
