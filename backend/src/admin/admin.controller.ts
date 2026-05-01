import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AdminUpdateUserDto } from '../users/dto/admin-update-user.dto';
import { AdminCreateUserDto } from '../users/dto/admin-create-user.dto';
import { SubjectsService } from '../subjects/subjects.service';
import { CreateSubjectDto } from '../subjects/dto/create-subject.dto';
import { UpdateSubjectDto } from '../subjects/dto/update-subject.dto';
import { AcademicService } from '../academic/academic.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly subjectsService: SubjectsService,
    private readonly academicService: AcademicService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('users')
  async getAllUsers() {
    return this.usersService.listAllUsersForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('students')
  async getStudents() {
    return this.usersService.getUsersByRole(UserRole.STUDENT);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('instructors')
  async getInstructors() {
    return this.usersService.getUsersByRole(UserRole.INSTRUCTOR);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('subjects')
  async listSubjects() {
    return this.subjectsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('subjects')
  async createSubject(
    @Body()
    body: {
      name?: string;
      title?: string;
      description?: string;
      instructorIds: string[];
    },
  ) {
    const dto = new CreateSubjectDto();
    dto.title = String(body.title ?? body.name ?? '').trim();
    dto.description = body.description;
    dto.instructorIds = body.instructorIds ?? [];
    return this.subjectsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('subjects/:id')
  async updateSubject(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      title?: string;
      description?: string;
      instructorIds?: string[];
    },
  ) {
    const dto = new UpdateSubjectDto();
    if (body.title !== undefined || body.name !== undefined) {
      dto.title = String(body.title ?? body.name ?? '').trim();
    }
    if (body.description !== undefined) {
      dto.description = body.description;
    }
    if (body.instructorIds !== undefined) {
      dto.instructorIds = body.instructorIds;
    }
    return this.subjectsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('subjects/:id')
  async deleteSubject(@Param('id') id: string) {
    return this.subjectsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('user/:id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    const result = await this.usersService.updateUserById(id, dto);

    // If class was updated, ensure enrollment is synced
    if (dto.class) {
      try {
        const schoolClass = await this.academicService.findClassByName(dto.class);
        if (schoolClass) {
          await this.academicService.enrollStudent(schoolClass._id.toString(), { studentId: id });
        }
      } catch (err) {
        console.error('Failed to sync enrollment during user update:', err);
      }
    }

    return result;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('user/:id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUserById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('user')
  async createUser(@Body() dto: AdminCreateUserDto) {
    console.log('AdminController.createUser called with dto:', dto);
    const result = await this.usersService.createUserByAdmin(dto);
    
    // If a classId was provided and it's a student, enroll them
    if (dto.classId && (dto.role === UserRole.STUDENT || !dto.role)) {
      try {
        await this.academicService.enrollStudent(dto.classId, { studentId: result.user.id });
      } catch (err) {
        console.error('Failed to enroll student during creation:', err);
        // We don't fail the whole user creation, but we could return a warning
      }
    }
    
    return result;
  }
}
