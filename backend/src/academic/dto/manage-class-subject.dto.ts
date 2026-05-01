import { IsString } from 'class-validator';

export class ManageClassSubjectDto {
  @IsString()
  subjectId: string;
}
