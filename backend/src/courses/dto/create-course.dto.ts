import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateModuleDto {
    @ApiProperty({ description: 'Module title', example: 'Introduction to Algebra' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ description: 'Module description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Display order of the module', example: 1 })
    @IsNumber()
    @IsOptional()
    order?: number;
}

export class CreateCourseDto {
    @ApiProperty({ description: 'Course title', example: 'Mathematics for First Year' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ description: 'Detailed course description' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: 'Academic level', example: '1st Year' })
    @IsString()
    @IsNotEmpty()
    level: string;

    @ApiPropertyOptional({
        description:
            'Logical subject title (groups multiple course chapters in MongoDB), e.g. Programmation Procédurale 1',
        example: 'Programmation Procédurale 1',
    })
    @IsString()
    @IsOptional()
    subject?: string;

    @ApiPropertyOptional({ description: 'MongoDB ID of the instructor (User)' })
    @IsString()
    @IsOptional()
    instructorId?: string;

    @ApiPropertyOptional({ type: [CreateModuleDto], description: 'List of course modules' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateModuleDto)
    @IsOptional()
    modules?: CreateModuleDto[];
}
