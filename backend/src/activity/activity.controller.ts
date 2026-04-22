import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/schemas/user.schema";
import { ActivityAction } from "./schemas/activity.schema";

@Controller("admin")
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get("activity")
  async getActivities(
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
    @Query("action") action?: ActivityAction,
    @Query("resourceType") resourceType?: string,
  ) {
    if (userId) {
      const events = await this.activityService.getUserActivities(userId, {
        limit: Number(limit || 500),
        action,
        resourceType,
      });
      return { status: "success", count: events.length, events };
    }
    return this.activityService.getAllActivities();
  }
}
