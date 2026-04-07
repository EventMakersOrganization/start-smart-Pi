import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AcademicService } from './academic.service';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';
import { ManageClassStudentDto } from './dto/manage-class-student.dto';
import { ManageClassSubjectDto } from './dto/manage-class-subject.dto';

@Controller('admin')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('classes')
  listClasses() {
    return this.academicService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('classes/:id')
  getClass(@Param('id') id: string) {
    return this.academicService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('classes')
  createClass(@Body() dto: CreateSchoolClassDto) {
    return this.academicService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('classes/:id')
  updateClass(@Param('id') id: string, @Body() dto: UpdateSchoolClassDto) {
    return this.academicService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('classes/:id')
  deleteClass(@Param('id') id: string) {
    return this.academicService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('classes/:id/students')
  enrollStudent(@Param('id') id: string, @Body() dto: ManageClassStudentDto) {
    return this.academicService.enrollStudent(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('classes/:id/students/:studentId')
  removeStudent(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.academicService.removeStudent(id, studentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('classes/:id/subjects')
  linkSubject(@Param('id') id: string, @Body() dto: ManageClassSubjectDto) {
    return this.academicService.linkSubject(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('classes/:id/subjects/:subjectId')
  unlinkSubject(@Param('id') id: string, @Param('subjectId') subjectId: string) {
    return this.academicService.unlinkSubject(id, subjectId);
  }
}
