import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { apiUrl } from '../../core/api-url';

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

  // Stats
  totalClasses = 0;
  totalStudentsEnrolled = 0;
  totalActiveClasses = 0;

  showClassModal = false;
  showLinkSubjectModal = false;
  showEnrollStudentModal = false;
  showAssignInstructorModal = false;
  
  editingClassId: string | null = null;
  classForm = this.createEmptyForm();

  loading = false;
  savingClass = false;
  actionLoading = false;
  error = '';
  success = '';

  filterText = '';
  activeTab: 'students' | 'subjects' | 'instructors' = 'students';

  private readonly classesApi = apiUrl('/api/admin/classes');
  private readonly studentsApi = apiUrl('/api/admin/students');
  private readonly subjectsApi = apiUrl('/api/admin/subjects');
  private readonly instructorsApi = apiUrl('/api/admin/instructors');

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

        this.updateStats();

        if (this.selectedClass) {
          this.selectedClass = this.classes.find((item) => item.id === this.selectedClass?.id) || this.classes[0] || null;
        } else {
          this.selectedClass = this.classes[0] || null;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('load data error', err);
        this.error = 'Failed to load academic data';
        this.loading = false;
      },
    });
  }

  updateStats() {
    this.totalClasses = this.classes.length;
    this.totalStudentsEnrolled = this.classes.reduce((acc, c) => acc + (c.studentCount || 0), 0);
    this.totalActiveClasses = this.classes.filter(c => c.active !== false).length;
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
    if (this.savingClass) return;
    this.showClassModal = false;
  }

  openLinkSubjectModal() {
    this.selectedSubjectIds = [];
    this.showLinkSubjectModal = true;
  }

  closeLinkSubjectModal() {
    this.showLinkSubjectModal = false;
  }

  openEnrollStudentModal() {
    this.selectedStudentIds = [];
    this.showEnrollStudentModal = true;
  }

  closeEnrollStudentModal() {
    this.showEnrollStudentModal = false;
  }

  openAssignInstructorModal() {
    this.selectedInstructorIds = [];
    this.showAssignInstructorModal = true;
  }

  closeAssignInstructorModal() {
    this.showAssignInstructorModal = false;
  }

  saveClass() {
    if (this.savingClass) return;

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
        this.loadData();
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
    if (!confirm(`Delete class ${row.name}?`)) return;

    this.http.delete(`${this.classesApi}/${row.id}`).subscribe({
      next: () => {
        this.loadData();
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
    if (!this.selectedClass || !this.selectedStudentIds.length || this.actionLoading) return;

    this.actionLoading = true;
    forkJoin(
      this.selectedStudentIds.map((studentId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/students`, { studentId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedStudentIds = [];
        this.showEnrollStudentModal = false;
        this.loadData();
        this.actionLoading = false;
        this.success = 'Students enrolled successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        console.error('enroll error', err);
        this.error = err.error?.message || 'Failed to enroll';
        this.actionLoading = false;
      },
    });
  }

  linkSelectedSubjects() {
    if (!this.selectedClass || !this.selectedSubjectIds.length || this.actionLoading) return;

    this.actionLoading = true;
    forkJoin(
      this.selectedSubjectIds.map((subjectId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/subjects`, { subjectId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedSubjectIds = [];
        this.showLinkSubjectModal = false;
        this.loadData();
        this.actionLoading = false;
        this.success = 'Subjects linked successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: (err) => {
        this.error = 'Failed to link subjects';
        this.actionLoading = false;
      },
    });
  }

  removeStudent(studentId: string) {
    if (!this.selectedClass) return;
    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/students/${studentId}`).subscribe({
      next: () => this.loadData(),
      error: () => this.error = 'Failed to remove student',
    });
  }

  unlinkSubject(subjectId: string) {
    if (!this.selectedClass) return;
    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/subjects/${subjectId}`).subscribe({
      next: () => this.loadData(),
      error: () => this.error = 'Failed to unlink subject',
    });
  }

  assignSelectedInstructors() {
    if (!this.selectedClass || !this.selectedInstructorIds.length || this.actionLoading) return;

    this.actionLoading = true;
    forkJoin(
      this.selectedInstructorIds.map((instructorId) =>
        this.http.post(`${this.classesApi}/${this.selectedClass?.id}/instructors`, { instructorId }),
      ),
    ).subscribe({
      next: () => {
        this.selectedInstructorIds = [];
        this.showAssignInstructorModal = false;
        this.loadData();
        this.actionLoading = false;
        this.success = 'Instructors assigned successfully';
        setTimeout(() => (this.success = ''), 2500);
      },
      error: () => {
        this.error = 'Failed to assign instructors';
        this.actionLoading = false;
      },
    });
  }

  removeInstructor(instructorId: string) {
    if (!this.selectedClass) return;
    this.http.delete(`${this.classesApi}/${this.selectedClass.id}/instructors/${instructorId}`).subscribe({
      next: () => this.loadData(),
      error: () => this.error = 'Failed to remove instructor',
    });
  }

  toggleStudentSelection(id: string) {
    const idx = this.selectedStudentIds.indexOf(id);
    if (idx >= 0) this.selectedStudentIds.splice(idx, 1);
    else this.selectedStudentIds.push(id);
  }

  toggleSubjectSelection(id: string) {
    const idx = this.selectedSubjectIds.indexOf(id);
    if (idx >= 0) this.selectedSubjectIds.splice(idx, 1);
    else this.selectedSubjectIds.push(id);
  }

  toggleInstructorSelection(id: string) {
    const idx = this.selectedInstructorIds.indexOf(id);
    if (idx >= 0) this.selectedInstructorIds.splice(idx, 1);
    else this.selectedInstructorIds.push(id);
  }
}
