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
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Difficulty } from './schemas/exercise.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
    constructor(private readonly exercisesService: ExercisesService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new exercise (instructor/admin only)' })
    @ApiResponse({ status: 201, description: 'Exercise created successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    create(@Body() createExerciseDto: CreateExerciseDto) {
        return this.exercisesService.create(createExerciseDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all exercises with optional filtering and pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'courseId', required: false, type: String })
    @ApiQuery({ name: 'difficulty', required: false, enum: Difficulty })
    @ApiResponse({ status: 200, description: 'Paginated list of exercises.' })
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('courseId') courseId?: string,
        @Query('difficulty') difficulty?: Difficulty,
    ) {
        return this.exercisesService.findAll(page, limit, courseId, difficulty);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single exercise by ID' })
    @ApiResponse({ status: 200, description: 'Exercise found.' })
    @ApiResponse({ status: 404, description: 'Exercise not found.' })
    findOne(@Param('id') id: string) {
        return this.exercisesService.findOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update an exercise (instructor/admin only)' })
    @ApiResponse({ status: 200, description: 'Exercise updated successfully.' })
    @ApiResponse({ status: 404, description: 'Exercise not found.' })
    update(@Param('id') id: string, @Body() updateExerciseDto: UpdateExerciseDto) {
        return this.exercisesService.update(id, updateExerciseDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete an exercise (instructor/admin only)' })
    @ApiResponse({ status: 200, description: 'Exercise deleted successfully.' })
    @ApiResponse({ status: 404, description: 'Exercise not found.' })
    remove(@Param('id') id: string) {
        return this.exercisesService.remove(id);
    }
}
