import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSubChapterContentDto {
    @ApiProperty({ description: 'Stable content identifier' })
    @IsString()
    @IsNotEmpty()
    contentId: string;

    @ApiProperty({ description: 'Folder bucket (cours/exercices/videos/ressources)' })
    @IsString()
    @IsNotEmpty()
    folder: string;

    @ApiProperty({ description: 'Content type (file/quiz/video/link/prosit/code)' })
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ description: 'Content title' })
    @IsString()
    @IsNotEmpty()
    title: string;
}

export class CreateSubChapterDto {
    @ApiProperty({ description: 'Subchapter title' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ description: 'Subchapter description' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ description: 'Display order of the subchapter', example: 1 })
    @IsNumber()
    @IsOptional()
    order?: number;

    @ApiPropertyOptional({ type: [CreateSubChapterContentDto], description: 'Subchapter contents' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSubChapterContentDto)
    @IsOptional()
    contents?: CreateSubChapterContentDto[];
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

    @ApiProperty({ description: 'Class', example: '1st Year' })
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

    @ApiPropertyOptional({
        description: 'MongoDB Subject document id — links this course chapter to the subject shell',
        example: '674a1b2c3d4e5f6789abcdef',
    })
    @IsString()
    @IsOptional()
    subjectId?: string;

    @ApiPropertyOptional({
        description: 'Chapter slot index within the subject (matches REST chapterOrder)',
        example: 0,
    })
    @IsNumber()
    @IsOptional()
    chapterOrder?: number;

    @ApiPropertyOptional({ description: 'MongoDB ID of the instructor (User)' })
    @IsString()
    @IsOptional()
    instructorId?: string;

    @ApiPropertyOptional({ type: [CreateSubChapterDto], description: 'List of course subchapters' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSubChapterDto)
    @IsOptional()
    subChapters?: CreateSubChapterDto[];
}
