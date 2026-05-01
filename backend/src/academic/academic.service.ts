import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { StudentProfile, StudentProfileDocument } from '../users/schemas/student-profile.schema';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';
import { ManageClassStudentDto } from './dto/manage-class-student.dto';
import { ManageClassSubjectDto } from './dto/manage-class-subject.dto';
import { SchoolClass, SchoolClassDocument } from './schemas/school-class.schema';
import { ClassEnrollment, ClassEnrollmentDocument } from './schemas/class-enrollment.schema';
import { ClassSubject, ClassSubjectDocument } from './schemas/class-subject.schema';
import { ClassInstructor, ClassInstructorDocument } from './schemas/class-instructor.schema';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { ManageClassInstructorDto } from './dto/manage-class-instructor.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

type ClassStudentResponse = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  status?: string;
  class?: string;
  attendance_percentage?: number;
};

type ClassSubjectResponse = {
  id: string;
  code: string;
  title: string;
  description?: string;
  instructors: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  }>;
};

@Injectable()
export class AcademicService {
  constructor(
    @InjectModel(SchoolClass.name)
    private schoolClassModel: Model<SchoolClassDocument>,
    @InjectModel(ClassEnrollment.name)
    private classEnrollmentModel: Model<ClassEnrollmentDocument>,
    @InjectModel(ClassSubject.name)
    private classSubjectModel: Model<ClassSubjectDocument>,
    @InjectModel(ClassInstructor.name)
    private classInstructorModel: Model<ClassInstructorDocument>,
    @InjectModel(Attendance.name)
    private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(StudentProfile.name)
    private studentProfileModel: Model<StudentProfileDocument>,
  ) {}

  private normalizeCode(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  private async generateUniqueClassCode(name: string): Promise<string> {
    const base = this.normalizeCode(name) || 'CLASS';
    let candidate = base;
    let suffix = 2;

    while (await this.schoolClassModel.exists({ code: candidate })) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid identifier');
    }

    return new Types.ObjectId(id);
  }

  private async findStudentById(studentId: string) {
    const student = await this.userModel
      .findById(studentId)
      .select('first_name last_name email role status')
      .exec();

    if (!student || String(student.role).toLowerCase() !== UserRole.STUDENT) {
      throw new BadRequestException('Student not found');
    }

    return student;
  }

  private async findClassById(classId: string) {
    const schoolClass = await this.schoolClassModel.findById(classId).exec();
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  async findClassByName(name: string) {
    return this.schoolClassModel.findOne({ name: name.trim() }).exec();
  }

  private async findSubjectById(subjectId: string) {
    const subject = await this.subjectModel
      .findById(subjectId)
      .populate('instructors', 'first_name last_name email role')
      .exec();

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  private profileLookupFilter(userId: string) {
    if (Types.ObjectId.isValid(userId)) {
      return { $or: [{ userId }, { userId: new Types.ObjectId(userId) }] } as any;
    }

    return { userId } as any;
  }

  private async updateStudentProfileClass(studentId: string, className: string | null) {
    await this.studentProfileModel
      .findOneAndUpdate(
        this.profileLookupFilter(studentId),
        { $set: { class: className }, $setOnInsert: { userId: studentId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async getClassStudents(classId: string): Promise<ClassStudentResponse[]> {
    const enrollments = await this.classEnrollmentModel
      .find({ schoolClassId: this.toObjectId(classId) })
      .populate('studentId', 'first_name last_name email status role')
      .sort({ createdAt: -1 })
      .lean<any[]>()
      .exec();

    const students = enrollments.map((enrollment) => enrollment.studentId).filter(Boolean);
    const studentIds = students.map((s: any) => s._id);

    // Fetch profiles to get attendance_percentage (handling both ObjectId and string representations)
    const profiles = await this.studentProfileModel.find({
      $or: [
        { userId: { $in: studentIds } },
        { userId: { $in: studentIds.map(id => String(id)) } }
      ]
    }).lean().exec();

    return students.map((student: any) => {
      const profile = profiles.find(p => String(p.userId) === String(student._id));
      return {
        id: String(student._id),
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        status: student.status,
        class: student.class,
        attendance_percentage: profile ? profile.attendance_percentage : 100,
      };
    });
  }

  private async getClassSubjects(classId: string): Promise<ClassSubjectResponse[]> {
    const links = await this.classSubjectModel
      .find({ schoolClassId: this.toObjectId(classId) })
      .populate({
        path: 'subjectId',
        populate: { path: 'instructors', select: 'first_name last_name email role' },
      })
      .sort({ createdAt: -1 })
      .lean<any[]>()
      .exec();

    return links
      .map((link) => link.subjectId)
      .filter(Boolean)
      .map((subject: any) => ({
        id: String(subject._id),
        code: subject.code,
        title: subject.title,
        description: subject.description,
        instructors: Array.isArray(subject.instructors)
          ? subject.instructors.map((instructor: any) => ({
              id: String(instructor._id),
              first_name: instructor.first_name,
              last_name: instructor.last_name,
              email: instructor.email,
              role: instructor.role,
            }))
          : [],
      }));
  }

  private async getClassInstructors(classId: string) {
    const assignments = await this.classInstructorModel
      .find({ schoolClassId: this.toObjectId(classId) })
      .populate('instructorId', 'first_name last_name email role')
      .sort({ createdAt: -1 })
      .lean<any[]>()
      .exec();

    return assignments
      .map((assignment) => assignment.instructorId)
      .filter(Boolean)
      .map((instructor: any) => ({
        id: String(instructor._id),
        first_name: instructor.first_name,
        last_name: instructor.last_name,
        email: instructor.email,
        role: instructor.role,
      }));
  }

  private async toResponse(schoolClass: SchoolClassDocument) {
    const classId = String(schoolClass._id);
    const [students, subjects, instructors] = await Promise.all([
      this.getClassStudents(classId),
      this.getClassSubjects(classId),
      this.getClassInstructors(classId),
    ]);

    return {
      id: classId,
      code: schoolClass.code,
      name: schoolClass.name,
      description: schoolClass.description,
      academicYear: schoolClass.academicYear,
      section: schoolClass.section,
      level: schoolClass.level,
      capacity: schoolClass.capacity,
      active: schoolClass.active,
      studentCount: students.length,
      subjectCount: subjects.length,
      instructorCount: instructors.length,
      students,
      subjects,
      instructors,
      createdAt: schoolClass.createdAt,
      updatedAt: schoolClass.updatedAt,
    };
  }

  async findAll() {
    const classes = await this.schoolClassModel.find().sort({ createdAt: -1 }).exec();
    return Promise.all(classes.map((schoolClass) => this.toResponse(schoolClass)));
  }

  async findOne(id: string) {
    const schoolClass = await this.schoolClassModel.findById(id).exec();
    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return this.toResponse(schoolClass);
  }

  async create(dto: CreateSchoolClassDto) {
    const name = String(dto.name || '').trim();
    if (!name) {
      throw new BadRequestException('Class name is required');
    }

    const code = await this.generateUniqueClassCode(name);
    const schoolClass = await this.schoolClassModel.create({
      code,
      name,
      description: dto.description?.trim() || '',
      academicYear: dto.academicYear?.trim() || undefined,
      section: dto.section?.trim() || undefined,
      level: dto.level?.trim() || undefined,
      capacity: dto.capacity ?? 0,
      active: dto.active ?? true,
    });

    return this.toResponse(schoolClass);
  }

  async update(id: string, dto: UpdateSchoolClassDto) {
    const schoolClass = await this.findClassById(id);
    const previousName = schoolClass.name;

    if (dto.name !== undefined) {
      const nextName = String(dto.name || '').trim();
      if (!nextName) {
        throw new BadRequestException('Class name cannot be empty');
      }
      schoolClass.name = nextName;
    }

    if (dto.description !== undefined) {
      schoolClass.description = dto.description?.trim() || '';
    }
    if (dto.academicYear !== undefined) {
      schoolClass.academicYear = dto.academicYear?.trim() || undefined;
    }
    if (dto.section !== undefined) {
      schoolClass.section = dto.section?.trim() || undefined;
    }
    if (dto.level !== undefined) {
      schoolClass.level = dto.level?.trim() || undefined;
    }
    if (dto.capacity !== undefined) {
      schoolClass.capacity = dto.capacity;
    }
    if (dto.active !== undefined) {
      schoolClass.active = dto.active;
    }

    await schoolClass.save();

    if (previousName !== schoolClass.name) {
      const enrollments = await this.classEnrollmentModel
        .find({ schoolClassId: schoolClass._id })
        .exec();
      await Promise.all(
        enrollments.map((enrollment) =>
          this.updateStudentProfileClass(String(enrollment.studentId), schoolClass.name),
        ),
      );
    }

    return this.toResponse(schoolClass);
  }

  async remove(id: string) {
    const schoolClass = await this.findClassById(id);
    const classId = schoolClass._id;

    const enrollments = await this.classEnrollmentModel.find({ schoolClassId: classId }).exec();
    await Promise.all(
      enrollments.map((enrollment) =>
        this.updateStudentProfileClass(String(enrollment.studentId), null),
      ),
    );

    await Promise.all([
      this.classEnrollmentModel.deleteMany({ schoolClassId: classId }).exec(),
      this.classSubjectModel.deleteMany({ schoolClassId: classId }).exec(),
      schoolClass.deleteOne(),
    ]);

    return { success: true };
  }

  async enrollStudent(classId: string, dto: ManageClassStudentDto) {
    const schoolClass = await this.findClassById(classId);
    const student = await this.findStudentById(dto.studentId);

    const existingEnrollment = await this.classEnrollmentModel
      .findOne({ studentId: student._id })
      .exec();

    if (existingEnrollment && String(existingEnrollment.schoolClassId) === String(schoolClass._id)) {
      await this.updateStudentProfileClass(String(student._id), schoolClass.name);
      return this.toResponse(schoolClass);
    }

    if (existingEnrollment && String(existingEnrollment.schoolClassId) !== String(schoolClass._id)) {
      await this.classEnrollmentModel.deleteOne({ _id: existingEnrollment._id }).exec();
    }

    await this.classEnrollmentModel.findOneAndUpdate(
      { schoolClassId: schoolClass._id, studentId: student._id },
      {
        $set: {
          schoolClassId: schoolClass._id,
          studentId: student._id,
          enrolledAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    await this.updateStudentProfileClass(String(student._id), schoolClass.name);

    return this.toResponse(schoolClass);
  }

  async removeStudent(classId: string, studentId: string) {
    const schoolClass = await this.findClassById(classId);
    const student = await this.findStudentById(studentId);

    await this.classEnrollmentModel
      .deleteOne({ schoolClassId: schoolClass._id, studentId: student._id })
      .exec();

    const profile = await this.studentProfileModel
      .findOne(this.profileLookupFilter(studentId))
      .exec();

    if (profile && String((profile as any).class || '') === schoolClass.name) {
      await this.updateStudentProfileClass(String(student._id), null);
    }

    return this.toResponse(schoolClass);
  }

  async linkSubject(classId: string, dto: ManageClassSubjectDto) {
    const schoolClass = await this.findClassById(classId);
    const subject = await this.findSubjectById(dto.subjectId);

    await this.classSubjectModel.findOneAndUpdate(
      { schoolClassId: schoolClass._id, subjectId: subject._id },
      {
        $set: {
          schoolClassId: schoolClass._id,
          subjectId: subject._id,
          linkedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    return this.toResponse(schoolClass);
  }

  async unlinkSubject(classId: string, subjectId: string) {
    const schoolClass = await this.findClassById(classId);
    const subject = await this.findSubjectById(subjectId);

    await this.classSubjectModel
      .deleteOne({ schoolClassId: schoolClass._id, subjectId: subject._id })
      .exec();

    return this.toResponse(schoolClass);
  }

  async getClassesForStudent(studentId: string) {
    const student = await this.findStudentById(studentId);
    const enrollment = await this.classEnrollmentModel
      .findOne({ studentId: student._id })
      .populate('schoolClassId')
      .exec();

    if (!enrollment?.schoolClassId) {
      return null;
    }

    return this.toResponse(enrollment.schoolClassId as any);
  }

  async getClassesForInstructor(instructorId: string) {
    const objectId = this.toObjectId(instructorId);
    
    // Find all subjects this instructor teaches
    const subjects = await this.subjectModel.find({ instructors: objectId }).exec();
    const subjectIds = subjects.map((s) => s._id);

    // Find all ClassSubject links for these subjects
    const classSubjects = await this.classSubjectModel.find({ subjectId: { $in: subjectIds } }).exec();
    const classIdsFromSubjects = classSubjects.map((cs) => cs.schoolClassId);

    // Find explicitly assigned classes
    const explicitAssignments = await this.classInstructorModel.find({ instructorId: objectId }).exec();
    const classIdsExplicit = explicitAssignments.map((ca) => ca.schoolClassId);

    // Filter to unique class IDs
    const uniqueClassIds = [...new Set([...classIdsFromSubjects, ...classIdsExplicit].map((id) => String(id)))];

    if (!uniqueClassIds.length) {
      return [];
    }

    // Fetch those classes
    const classes = await this.schoolClassModel.find({ _id: { $in: uniqueClassIds } }).sort({ createdAt: -1 }).exec();

    return Promise.all(classes.map((schoolClass) => this.toResponse(schoolClass)));
  }

  async submitAttendance(instructorId: string, dto: SubmitAttendanceDto) {
    const schoolClassId = this.toObjectId(dto.schoolClassId);
    
    // Ensure date is treated as UTC midnight to avoid local timezone offset shifts
    const dateStr = dto.date.split('T')[0];
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    
    const instId = this.toObjectId(instructorId);
    const sessionType = dto.sessionType;

    const records = dto.records.map((r) => ({
      studentId: this.toObjectId(r.studentId),
      status: r.status,
    }));

    // Update if exists for this class, date and sessionType, otherwise create
    const attendance = await this.attendanceModel.findOneAndUpdate(
      { schoolClassId, date, sessionType },
      {
        $set: {
          instructorId: instId,
          records,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    // Trigger recalculation of percentages for all students in the class
    await this.recalculateClassAttendance(dto.schoolClassId);

    return attendance;
  }

  private async recalculateClassAttendance(classId: string) {
    const schoolClassId = this.toObjectId(classId);
    
    // 1. Get all attendance sessions for this class
    const allAttendance = await this.attendanceModel.find({ schoolClassId }).exec();
    const totalSessions = allAttendance.length;
    
    if (totalSessions === 0) return;

    // 2. Get all students enrolled in this class
    const enrollments = await this.classEnrollmentModel.find({ schoolClassId }).exec();
    const studentIds = enrollments.map(e => String(e.studentId));

    // 3. For each student, calculate their attendance percentage
    for (const studentId of studentIds) {
      let absences = 0;
      
      for (const session of allAttendance) {
        const record = session.records.find(r => String(r.studentId) === studentId);
        // We assume that if no record exists for a student in a session, they were not expected or present?
        // But usually every student in the class is in the records list.
        if (record && record.status === 'absent') {
          absences++;
        }
      }
      
      const percentage = Math.round(((totalSessions - absences) / totalSessions) * 100);
      
      await this.studentProfileModel.findOneAndUpdate(
        this.profileLookupFilter(studentId),
        { $set: { attendance_percentage: percentage }, $setOnInsert: { userId: this.toObjectId(studentId) } },
        { upsert: true }
      ).exec();
    }
  }

  async getAttendance(classId: string, date: string, sessionType: string) {
    const schoolClassId = this.toObjectId(classId);
    
    const dateStr = date.split('T')[0];
    const queryDate = new Date(`${dateStr}T00:00:00.000Z`);

    return this.attendanceModel
      .findOne({ schoolClassId, date: queryDate, sessionType })
      .exec();
  }

  async getAllAttendance(classId: string) {
    const schoolClassId = this.toObjectId(classId);
    return this.attendanceModel
      .find({ schoolClassId })
      .sort({ date: -1, sessionType: 1 })
      .exec();
  }


  async assignInstructor(classId: string, dto: ManageClassInstructorDto) {
    const schoolClass = await this.findClassById(classId);
    
    const instructor = await this.userModel.findOne({
      _id: dto.instructorId,
      role: { $in: [UserRole.INSTRUCTOR, UserRole.ADMIN] },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor not found or invalid role');
    }

    await this.classInstructorModel.findOneAndUpdate(
      { schoolClassId: schoolClass._id, instructorId: instructor._id },
      { $setOnInsert: { schoolClassId: schoolClass._id, instructorId: instructor._id, assignedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    return this.toResponse(schoolClass);
  }

  async removeInstructor(classId: string, instructorId: string) {
    const schoolClass = await this.findClassById(classId);

    await this.classInstructorModel
      .deleteOne({ schoolClassId: schoolClass._id, instructorId: instructorId })
      .exec();

    return this.toResponse(schoolClass);
  }
}
