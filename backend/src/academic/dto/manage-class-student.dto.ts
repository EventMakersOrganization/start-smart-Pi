import { IsString } from 'class-validator';

export class ManageClassStudentDto {
  @IsString()
  studentId: string;
}
