import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/api-url';

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

  // Stats
  totalSubjects = 0;
  totalAssignments = 0;
  avgInstructorsPerSubject = 0;

  showAddSubjectModal = false;
  showEditSubjectModal = false;
  showInstructorsModal = false;
  selectedSubject: SubjectRow | null = null;
  editingSubjectId: string | null = null;

  // Dropdown states
  showAddInstructorDropdown = false;
  showEditInstructorDropdown = false;

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
    this.http.get<SubjectRow[]>(apiUrl('/api/admin/subjects')).subscribe({
      next: (data) => {
        this.subjects = data;
        this.updateStats();
      },
      error: (err) => {
        console.error('load subjects error', err);
        this.error = 'Failed to load subjects';
      }
    });
  }

  getValidInstructorCount(subject: SubjectRow): number {
    if (!subject.instructors) return 0;
    return subject.instructors.filter(i => 
      i && i.id && this.instructors.some(gi => String(gi.id) === String(i.id))
    ).length;
  }

  updateStats() {
    this.totalSubjects = this.subjects.length;
    this.totalAssignments = this.subjects.reduce((acc, s) => acc + this.getValidInstructorCount(s), 0);
    this.avgInstructorsPerSubject = this.totalSubjects > 0 ? parseFloat((this.totalAssignments / this.totalSubjects).toFixed(1)) : 0;
  }

  loadInstructors() {
    this.http.get<InstructorOption[]>(apiUrl('/api/admin/instructors')).subscribe({
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

    this.http.post(apiUrl('/api/admin/subjects'), body).subscribe({
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
    this.editingSubjectId = subject.id;
    this.editModels[subject.id] = {
      name: subject.name,
      description: subject.description || '',
      instructorIds: (subject.instructors || [])
        .filter(i => i && i.id)
        .map((i) => i.id),
    };
    this.showEditSubjectModal = true;
  }

  cancelEdit(id: string) {
    this.showEditSubjectModal = false;
    this.editingSubjectId = null;
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

    this.http.put(apiUrl(`/api/admin/subjects/${id}`), {
      name: model.name.trim(),
      description: model.description.trim(),
      instructorIds: model.instructorIds,
    }).subscribe({
      next: () => {
        this.showEditSubjectModal = false;
        this.editingSubjectId = null;
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

    this.http.delete(apiUrl(`/api/admin/subjects/${id}`)).subscribe({
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

  toggleInstructorSelection(id: string, isNew: boolean, subjectId?: string) {
    let list: string[] = [];
    if (isNew) {
      list = this.newSubjectInstructorIds;
    } else if (subjectId && this.editModels[subjectId]) {
      list = this.editModels[subjectId].instructorIds;
    }

    const idx = list.findIndex(sid => String(sid) === String(id));
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(id);
    }
  }

  isInstructorSelected(id: string, isNew: boolean, subjectId?: string): boolean {
    if (isNew) {
      return this.newSubjectInstructorIds.some(sid => String(sid) === String(id));
    } else if (subjectId && this.editModels[subjectId]) {
      return this.editModels[subjectId].instructorIds.some(sid => String(sid) === String(id));
    }
    return false;
  }

  getSelectedInstructorNames(isNew: boolean, subjectId?: string): string {
    const list = isNew ? this.newSubjectInstructorIds : (subjectId && this.editModels[subjectId] ? this.editModels[subjectId].instructorIds : []);
    
    if (!list || list.length === 0) return 'Select Instructors';
    
    const names = list.map(id => {
      const inst = this.instructors.find(i => String(i.id) === String(id));
      return inst ? `${inst.first_name} ${inst.last_name}` : null;
    }).filter(n => n !== null) as string[];

    return names.length > 0 ? names.join(', ') : 'Select Instructors';
  }

  getSubjectIcon(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('algo')) return 'code';
    if (n.includes('graphe')) return 'account_tree';
    if (n.includes('architecture') || n.includes('si')) return 'layers';
    if (n.includes('data')) return 'database';
    if (n.includes('math')) return 'calculate';
    if (n.includes('ai') || n.includes('intelligence')) return 'psychology';
    if (n.includes('web')) return 'language';
    if (n.includes('mobile')) return 'phone_android';
    if (n.includes('cloud')) return 'cloud';
    return 'menu_book';
  }
}
