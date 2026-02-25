import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AdminUpdateUserDto } from '../users/dto/admin-update-user.dto';
import { AdminCreateUserDto } from '../users/dto/admin-create-user.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

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
  @Put('user/:id')
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.usersService.updateUserById(id, dto);
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
    return this.usersService.createUserByAdmin(dto);
  }
}
