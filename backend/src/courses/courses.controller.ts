import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    Delete,
    Query,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new course (instructor/admin only)' })
    @ApiResponse({ status: 201, description: 'Course created successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    create(@Body() createCourseDto: CreateCourseDto) {
        return this.coursesService.create(createCourseDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all courses with optional filters and pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'level', required: false, type: String, example: '1st Year' })
    @ApiQuery({ name: 'instructorId', required: false, type: String })
    @ApiResponse({ status: 200, description: 'Paginated list of courses.' })
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('level') level?: string,
        @Query('instructorId') instructorId?: string,
    ) {
        return this.coursesService.findAll(page, limit, level, instructorId);
    }

    @Get('subjects/list')
    @ApiOperation({ summary: 'List logical subjects grouped from courses' })
    @ApiQuery({ name: 'instructorId', required: false, type: String })
    getSubjectsFromCourses(@Query('instructorId') instructorId?: string) {
        return this.coursesService.findAllSubjects(instructorId);
    }

    @Get('subjects/by-title/:subjectTitle')
    @ApiOperation({ summary: 'Get one logical subject grouped from courses' })
    @ApiQuery({ name: 'instructorId', required: false, type: String })
    getSubjectFromCourses(
        @Param('subjectTitle') subjectTitle: string,
        @Query('instructorId') instructorId?: string,
    ) {
        return this.coursesService.findSubjectByTitle(decodeURIComponent(subjectTitle), instructorId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single course by ID' })
    @ApiResponse({ status: 200, description: 'Course found.' })
    @ApiResponse({ status: 404, description: 'Course not found.' })
    findOne(@Param('id') id: string) {
        return this.coursesService.findOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a course (instructor/admin only)' })
    @ApiResponse({ status: 200, description: 'Course updated successfully.' })
    @ApiResponse({ status: 404, description: 'Course not found.' })
    update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
        return this.coursesService.update(id, updateCourseDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a course (instructor/admin only)' })
    @ApiResponse({ status: 200, description: 'Course deleted successfully.' })
    @ApiResponse({ status: 404, description: 'Course not found.' })
    remove(@Param('id') id: string) {
        return this.coursesService.remove(id);
    }
}
