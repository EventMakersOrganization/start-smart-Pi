import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

interface StudentOption {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  status?: string;
  class?: string;
}

interface SubjectOption {
  id: string;
  code: string;
  title: string;
  description?: string;
  instructors?: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  }>;
}

interface InstructorOption {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  status?: string;
}

interface ClassStudent {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  status?: string;
  class?: string;
}

interface ClassSubject {
  id: string;
  code: string;
  title: string;
  description?: string;
  instructors?: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  }>;
}

interface SchoolClassRow {
  id: string;
  code: string;
  name: string;
  description?: string;
  academicYear?: string;
  section?: string;
  level?: string;
  capacity?: number;
  active?: boolean;
  studentCount?: number;
  subjectCount?: number;
  instructorCount?: number;
  students?: ClassStudent[];
  subjects?: ClassSubject[];
  instructors?: InstructorOption[];
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-class-management',
  templateUrl: './class-management.component.html',
  styleUrls: []
})
export class ClassManagementComponent implements OnInit {
  classes: SchoolClassRow[] = [];
  students: StudentOption[] = [];
  subjects: SubjectOption[] = [];
  instructors: InstructorOption[] = [];

  selectedClass: SchoolClassRow | null = null;
  selectedStudentIds: string[] = [];
  selectedSubjectIds: string[] = [];
  selectedInstructorIds: string[] = [];

  showClassModal = false;
  editingClassId: string | null = null;
  classForm = this.createEmptyForm();

  loading = false;
  savingClass = false;
  actionLoading = false;
  error = '';
  success = '';

  filterText = '';
  activeTab: 'students' | 'subjects' | 'instructors' = 'students';

  private readonly classesApi = 'http://localhost:3000/api/admin/classes';
  private readonly studentsApi = 'http://localhost:3000/api/admin/students';
  private readonly subjectsApi = 'http://localhost:3000/api/admin/subjects';
  private readonly instructorsApi = 'http://localhost:3000/api/admin/instructors';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  get filteredClasses(): SchoolClassRow[] {
    const text = (this.filterText || '').trim().toLowerCase();
    if (!text) {
      return this.classes;
    }

    return this.classes.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const level = (item.level || '').toLowerCase();
      const academicYear = (item.academicYear || '').toLowerCase();
      const section = (item.section || '').toLowerCase();

      return (
        name.includes(text) ||
        code.includes(text) ||
        level.includes(text) ||
        academicYear.includes(text) ||
        section.includes(text)
      );
    });
  }

  get availableStudents(): StudentOption[] {
    // Show only students who are NOT assigned to any class yet
    return this.students.filter((student) => !student.class);
  }

  get availableSubjects(): SubjectOption[] {
    if (!this.selectedClass) {
      return this.subjects;
    }

    const linkedIds = new Set((this.selectedClass.subjects || []).map((subject) => subject.id));
    return this.subjects.filter((subject) => !linkedIds.has(subject.id));
  }

  get availableInstructors(): InstructorOption[] {
    if (!this.selectedClass) {
      return this.instructors;
    }

    const assignedIds = new Set((this.selectedClass.instructors || []).map((inst) => inst.id));
    return this.instructors.filter((inst) => !assignedIds.has(inst.id));
  }

  private createEmptyForm() {
    return {
      name: '',
      description: '',
      academicYear: '',
      section: '',
      level: '',
      capacity: 0,
      active: true,
    };
  }

  loadData() {
    this.loading = true;
    this.error = '';

    forkJoin({
      classes: this.http.get<SchoolClassRow[]>(this.classesApi),
      students: this.http.get<StudentOption[]>(this.studentsApi),
      subjects: this.http.get<SubjectOption[]>(this.subjectsApi),
      instructors: this.http.get<InstructorOption[]>(this.instructorsApi),
    }).subscribe({
      next: ({ classes, students, subjects, instructors }) => {
        this.classes = classes || [];
        this.students = students || [];
        this.subjects = subjects || [];
        this.instructors = instructors || [];

        if (this.selectedClass) {
          this.selectedClass = this.classes.find((item) => item.id === this.selectedClass?.id) || this.classes[0] || null;
        } else {
          this.selectedClass = this.classes[0] || null;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('load classes error', err);
        this.error = 'Failed to load academic data';
        this.loading = false;
      },
    });
  }

  refreshSelectedClass(classId?: string) {
    if (!classId) {
      this.selectedClass = null;
      return;
    }

    this.http.get<SchoolClassRow>(`${this.classesApi}/${classId}`).subscribe({
      next: (row) => {
        this.selectedClass = row;
        this.classes = this.classes.map((item) => (item.id === row.id ? row : item));
      },
      error: (err) => {
        console.error('refresh class error', err);
        this.error = 'Failed to refresh the selected class';
      },
    });
  }

  openCreateModal() {
    this.editingClassId = null;
    this.classForm = this.createEmptyForm();
    this.showClassModal = true;
  }

  openEditModal(row: SchoolClassRow) {
    this.editingClassId = row.id;
    this.classForm = {
      name: row.name || '',
      description: row.description || '',
      academicYear: row.academicYear || '',
      section: row.section || '',
      level: row.level || '',
      capacity: row.capacity || 0,
      active: row.active !== false,
    };
    this.showClassModal = true;
  }

  closeClassModal() {
    if (this.savingClass) {
      return;
    }

    this.showClassModal = false;
  }

  saveClass() {
    if (this.savingClass) {
      return;
    }

    const name = this.classForm.name.trim();
    if (!name) {
      this.error = 'Class name is required';
      return;
    }

    this.savingClass = true;
    this.error = '';

    const payload = {
      name,
      description: this.classForm.description.trim(),
      academicYear: this.classForm.academicYear.trim(),
      section: this.classForm.section.trim(),
      level: this.classForm.level.trim(),
      capacity: Number(this.classForm.capacity || 0),
      active: !!this.classForm.active,
    };

    const request = this.editingClassId
      ? this.http.put<SchoolClassRow>(`${this.classesApi}/${this.editingClassId}`, payload)
      : this.http.post<SchoolClassRow>(this.classesApi, payload);

    request.subscribe({
      next: (row) => {
        if (this.editingClassId) {
          this.classes = this.classes.map((item) => (item.id === row.id ? row : item));
          if (this.selectedClass?.id === row.id) {
            this.selectedClass = row;
          }
        } else {
          this.classes = [row, ...this.classes];
          this.selectedClass = row;
        }

        this.showClassModal = false;
        this.savingClass = false;
        this.success = this.editingClassId ? 'Class updated successfully' : 'Class created successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('save class error', err);
        this.error = err.error?.message || 'Failed to save class';
        this.savingClass = false;
      },
    });
  }

  deleteClass(row: SchoolClassRow) {
    if (!confirm(`Delete class ${row.name}?`)) {
      return;
    }

    this.http.delete(`${this.classesApi}/${row.id}`).subscribe({
      next: () => {
        this.classes = this.classes.filter((item) => item.id !== row.id);
        if (this.selectedClass?.id === row.id) {
          this.selectedClass = this.classes[0] || null;
        }
        this.success = 'Class deleted';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('delete class error', err);
        this.error = err.error?.message || 'Failed to delete class';
      },
    });
  }

  selectClass(row: SchoolClassRow) {
    this.selectedClass = row;
    this.selectedStudentIds = [];
    this.selectedSubjectIds = [];
    this.selectedInstructorIds = [];
  }

  setActiveTab(tab: 'students' | 'subjects' | 'instructors') {
    this.activeTab = tab;
  }

  enrollSelectedStudents() {
    if (!this.selectedClass || !this.selectedStudentIds.length || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    forkJoin(
      this.selectedStudentIds.map((studentId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/students`, { studentId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedStudentIds = [];
        this.loadData();
        this.actionLoading = false;
        this.success = 'Students enrolled successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('enroll students error', err);
        this.error = err.error?.message || 'Failed to enroll students';
        this.actionLoading = false;
      },
    });
  }

  linkSelectedSubjects() {
    if (!this.selectedClass || !this.selectedSubjectIds.length || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    forkJoin(
      this.selectedSubjectIds.map((subjectId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/subjects`, { subjectId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedSubjectIds = [];
        this.loadData();
        this.actionLoading = false;
        this.success = 'Subjects linked successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('link subjects error', err);
        this.error = err.error?.message || 'Failed to link subjects';
        this.actionLoading = false;
      },
    });
  }

  removeStudent(studentId: string) {
    if (!this.selectedClass) {
      return;
    }

    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/students/${studentId}`).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        console.error('remove student error', err);
        this.error = err.error?.message || 'Failed to remove student';
      },
    });
  }

  unlinkSubject(subjectId: string) {
    if (!this.selectedClass) {
      return;
    }

    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/subjects/${subjectId}`).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        console.error('unlink subject error', err);
        this.error = err.error?.message || 'Failed to unlink subject';
      },
    });
  }

  assignSelectedInstructors() {
    if (!this.selectedClass || !this.selectedInstructorIds.length || this.actionLoading) {
      return;
    }

    this.actionLoading = true;
    forkJoin(
      this.selectedInstructorIds.map((instructorId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/instructors`, { instructorId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedInstructorIds = [];
        this.loadData();
        this.actionLoading = false;
        this.success = 'Instructors assigned successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('assign instructors error', err);
        this.error = err.error?.message || 'Failed to assign instructors';
        this.actionLoading = false;
      },
    });
  }

  removeInstructor(instructorId: string) {
    if (!this.selectedClass) {
      return;
    }

    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/instructors/${instructorId}`).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        console.error('remove instructor error', err);
        this.error = err.error?.message || 'Failed to remove instructor';
      },
    });
  }

  labelStudent(student: StudentOption | ClassStudent) {
    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    return name ? `${name} (${student.email})` : student.email;
  }

  labelSubject(subject: SubjectOption | ClassSubject) {
    return `${subject.code} - ${subject.title}`;
  }

  labelInstructor(instructor: InstructorOption) {
    const name = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim();
    return name ? `${name} (${instructor.email})` : instructor.email;
  }
}
