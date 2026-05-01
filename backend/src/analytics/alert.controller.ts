import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  create(@Body() createAlertDto: any) {
    return this.alertService.create(createAlertDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findAll() {
    return this.alertService.findAll();
  }

  @Get('count')
  @Roles(UserRole.ADMIN)
  count() {
    return this.alertService.count();
  }

  @Get('unresolved')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findUnresolved() {
    return this.alertService.findUnresolved();
  }

  @Get('me')
  @Roles(UserRole.STUDENT, UserRole.ADMIN, UserRole.INSTRUCTOR)
  findMyAlerts(@Request() req, @Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.alertService.findMyAlerts(req.user.id, limit || 20);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.alertService.findOne(id);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findByStudent(@Param('studentId') studentId: string) {
    return this.alertService.findByStudent(studentId);
  }

  @Get('instructor/:instructorId')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  findByInstructor(@Param('instructorId') instructorId: string) {
    return this.alertService.findByInstructor(instructorId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  update(@Param('id') id: string, @Body() updateAlertDto: any) {
    return this.alertService.update(id, updateAlertDto);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  resolve(@Param('id') id: string) {
    return this.alertService.resolve(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.alertService.remove(id);
  }
}
