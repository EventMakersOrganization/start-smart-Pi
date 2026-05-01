import { IsNotEmpty, IsString } from 'class-validator';

export class ManageClassInstructorDto {
  @IsNotEmpty()
  @IsString()
  instructorId: string;
}
