import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface InstructorOption {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

interface SubjectRow {
  id: string;
  name: string;
  description?: string;
  instructors: InstructorOption[];
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-subjects-management',
  templateUrl: './subjects-management.component.html',
  styleUrls: []
})
export class SubjectsManagementComponent implements OnInit {
  subjects: SubjectRow[] = [];
  instructors: InstructorOption[] = [];
  editing: Record<string, boolean> = {};
  editModels: Record<string, { name: string; description: string; instructorIds: string[] }> = {};

  error = '';
  success = '';
  filterText = '';

  showAddSubjectModal = false;
  showInstructorsModal = false;
  selectedSubject: SubjectRow | null = null;
  addSubjectLoading = false;
  addSubjectError = '';
  newSubjectName = '';
  newSubjectDescription = '';
  newSubjectInstructorIds: string[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadInstructors();
    this.loadSubjects();
  }

  get filteredSubjects(): SubjectRow[] {
    const text = this.filterText.trim().toLowerCase();
    if (!text) {
      return this.subjects;
    }

    return this.subjects.filter((subject) => {
      const instructorNames = subject.instructors
        .map((i) => `${i.first_name || ''} ${i.last_name || ''} ${i.email}`.toLowerCase())
        .join(' ');

      return (
        subject.name.toLowerCase().includes(text) ||
        (subject.description || '').toLowerCase().includes(text) ||
        instructorNames.includes(text)
      );
    });
  }

  loadSubjects() {
    this.http.get<SubjectRow[]>('http://localhost:3000/api/admin/subjects').subscribe({
      next: (data) => {
        this.subjects = data;
      },
      error: (err) => {
        console.error('load subjects error', err);
        this.error = 'Failed to load subjects';
      }
    });
  }

  loadInstructors() {
    this.http.get<InstructorOption[]>('http://localhost:3000/api/admin/instructors').subscribe({
      next: (data) => {
        this.instructors = data;
      },
      error: (err) => {
        console.error('load instructors error', err);
        this.error = 'Failed to load instructors list';
      }
    });
  }

  openAddSubjectModal() {
    this.addSubjectError = '';
    this.newSubjectName = '';
    this.newSubjectDescription = '';
    this.newSubjectInstructorIds = [];
    this.showAddSubjectModal = true;
  }

  closeAddSubjectModal() {
    if (this.addSubjectLoading) return;
    this.showAddSubjectModal = false;
  }

  createSubject() {
    if (this.addSubjectLoading) return;

    const name = this.newSubjectName.trim();
    if (!name) {
      this.addSubjectError = 'Subject name is required.';
      return;
    }

    if (!this.newSubjectInstructorIds.length) {
      this.addSubjectError = 'Please select at least one instructor.';
      return;
    }

    this.addSubjectLoading = true;
    this.addSubjectError = '';

    const body = {
      name,
      description: this.newSubjectDescription.trim(),
      instructorIds: this.newSubjectInstructorIds,
    };

    this.http.post('http://localhost:3000/api/admin/subjects', body).subscribe({
      next: () => {
        this.addSubjectLoading = false;
        this.showAddSubjectModal = false;
        this.loadSubjects();
        this.success = 'Subject created successfully';
        setTimeout(() => this.success = '', 2500);
      },
      error: (err) => {
        console.error('create subject error', err);
        this.addSubjectError = err.error?.message || 'Failed to create subject';
        this.addSubjectLoading = false;
      }
    });
  }

  startEdit(subject: SubjectRow) {
    this.editing[subject.id] = true;
    this.editModels[subject.id] = {
      name: subject.name,
      description: subject.description || '',
      instructorIds: subject.instructors.map((i) => i.id),
    };
  }

  cancelEdit(id: string) {
    delete this.editing[id];
    delete this.editModels[id];
  }

  save(id: string) {
    const model = this.editModels[id];
    if (!model) return;

    if (!model.name.trim()) {
      this.error = 'Subject name is required.';
      return;
    }

    if (!model.instructorIds.length) {
      this.error = 'Please select at least one instructor.';
      return;
    }

    this.http.put(`http://localhost:3000/api/admin/subjects/${id}`, {
      name: model.name.trim(),
      description: model.description.trim(),
      instructorIds: model.instructorIds,
    }).subscribe({
      next: () => {
        this.cancelEdit(id);
        this.loadSubjects();
        this.success = 'Subject updated successfully';
        this.error = '';
        setTimeout(() => this.success = '', 2500);
      },
      error: (err) => {
        console.error('update subject error', err);
        this.error = err.error?.message || 'Failed to update subject';
      }
    });
  }

  deleteSubject(id: string) {
    if (!confirm('Delete this subject?')) return;

    this.http.delete(`http://localhost:3000/api/admin/subjects/${id}`).subscribe({
      next: () => {
        this.loadSubjects();
        this.success = 'Subject deleted';
        this.error = '';
        setTimeout(() => this.success = '', 2500);
      },
      error: (err) => {
        console.error('delete subject error', err);
        this.error = err.error?.message || 'Failed to delete subject';
      }
    });
  }

  openInstructorsModal(subject: SubjectRow) {
    this.selectedSubject = subject;
    this.showInstructorsModal = true;
  }

  closeInstructorsModal() {
    this.showInstructorsModal = false;
    this.selectedSubject = null;
  }

  instructorLabel(instructor: InstructorOption) {
    const name = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim();
    if (name && instructor.email) {
      return `${name} (${instructor.email})`;
    }
    if (name) {
      return name;
    }
    if (instructor.email) {
      return instructor.email;
    }
    return `Instructor ${String(instructor.id).slice(-6)}`;
  }

  toggleInstructorSelection(id: string, isNew: boolean, subjectId?: string) {
    let list: string[] = [];
    if (isNew) {
      list = this.newSubjectInstructorIds;
    } else if (subjectId) {
      list = this.editModels[subjectId].instructorIds;
    }

    const idx = list.indexOf(id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(id);
    }
  }

  isInstructorSelected(id: string, isNew: boolean, subjectId?: string): boolean {
    if (isNew) {
      return this.newSubjectInstructorIds.includes(id);
    } else if (subjectId) {
      return this.editModels[subjectId].instructorIds.includes(id);
    }
    return false;
  }
}
