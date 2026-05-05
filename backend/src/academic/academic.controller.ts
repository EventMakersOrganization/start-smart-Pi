import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AcademicService } from './academic.service';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';
import { ManageClassStudentDto } from './dto/manage-class-student.dto';
import { ManageClassSubjectDto } from './dto/manage-class-subject.dto';
import { ManageClassInstructorDto } from './dto/manage-class-instructor.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

@Controller('admin')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @Get('instructor/classes')
  getInstructorClasses(@Req() req: any) {
    console.log('getInstructorClasses called. req.user:', req?.user);
    const instructorId = req?.user?.id || req?.user?.userId || req?.user?._id || req?.user?.sub;
    console.log('Resolved instructorId:', instructorId);
    return this.academicService.getClassesForInstructor(String(instructorId));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @Post('attendance')
  submitAttendance(@Req() req: any, @Body() dto: SubmitAttendanceDto) {
    const instructorId = req?.user?.id || req?.user?.userId || req?.user?._id || req?.user?.sub;
    return this.academicService.submitAttendance(String(instructorId), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @Get('attendance/:classId/:date/:sessionType')
  getAttendance(@Param('classId') classId: string, @Param('date') date: string, @Param('sessionType') sessionType: string) {
    return this.academicService.getAttendance(classId, date, sessionType);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @Get('attendance/:classId')
  getAllAttendance(@Param('classId') classId: string) {
    return this.academicService.getAllAttendance(classId);
  }

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('classes/:id/instructors')
  assignInstructor(@Param('id') id: string, @Body() dto: ManageClassInstructorDto) {
    return this.academicService.assignInstructor(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('classes/:id/instructors/:instructorId')
  removeInstructor(@Param('id') id: string, @Param('instructorId') instructorId: string) {
    return this.academicService.removeInstructor(id, instructorId);
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @Delete('attendance/:classId/:date')
  deleteAttendance(@Param('classId') classId: string, @Param('date') date: string) {
    return this.academicService.deleteAttendance(classId, date);
  }
}

