import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  status: 'present' | 'absent' | 'late';
}

export class SubmitAttendanceDto {
  @IsString()
  @IsNotEmpty()
  schoolClassId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // ISO date string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}
