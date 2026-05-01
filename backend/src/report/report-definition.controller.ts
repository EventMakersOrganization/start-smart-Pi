import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { ReportDefinitionService } from './report-definition.service';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';

@Controller('reports/definitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportDefinitionController {
  constructor(private readonly reportDefinitionService: ReportDefinitionService) {}

  private userId(req: any): string {
    const u = req?.user;
    return String(u?.userId || u?.id || u?._id || '');
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  create(@Req() req: any, @Body() dto: CreateReportDefinitionDto) {
    return this.reportDefinitionService.create(this.userId(req), dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findAll(@Req() req: any) {
    return this.reportDefinitionService.findAllForOwner(this.userId(req));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.reportDefinitionService.findOne(id, this.userId(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateReportDefinitionDto) {
    return this.reportDefinitionService.update(id, this.userId(req), dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.reportDefinitionService.remove(id, this.userId(req));
  }

  @Post(':id/run')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  run(@Req() req: any, @Param('id') id: string) {
    return this.reportDefinitionService.run(id, this.userId(req));
  }
}
