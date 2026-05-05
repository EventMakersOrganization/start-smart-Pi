import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface UserRow {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  isOnline?: boolean;
  password?: string;
}

@Component({
  selector: 'app-teacher-management',
  templateUrl: './teacher-management.component.html',
  styleUrls: []
})
export class TeacherManagementComponent implements OnInit {
  teachers: UserRow[] = [];
  editing: Record<string, boolean> = {};
  editModels: Record<string, Partial<UserRow>> = {};
  error = '';
  success = '';

  // Stats
  totalInstructors = 0;
  activeInstructors = 0;
  offlineInstructors = 0;

  filterText = '';
  filterStatus = 'Status: All';
  showStatusDropdown = false;

  // add-user modal state
  showAddUserModal = false;
  newUserFirstName = '';
  newUserLastName = '';
  newUserEmail = '';
  newUserPhone = '';
  newUserRole: 'student' | 'instructor' | 'admin' = 'instructor';
  addUserLoading = false;
  addUserError = '';

  // edit modal state
  showEditModal = false;
  editingTeacherId: string | null = null;

  get filteredTeachers(): UserRow[] {
    const text = (this.filterText || '').trim().toLowerCase();
    
    return this.teachers.filter(t => {
      if (text) {
        const firstName = (t.first_name || '').toLowerCase();
        const lastName = (t.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const email = (t.email || '').toLowerCase();
        
        const match =
          firstName.includes(text) ||
          lastName.includes(text) ||
          fullName.includes(text) ||
          email.includes(text);
          
        if (!match) return false;
      }
      
      if (this.filterStatus && this.filterStatus !== 'Status: All') {
        const status = t.status || 'active';
        if (status.toLowerCase() !== this.filterStatus.toLowerCase()) return false;
      }
      
      return true;
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    this.http.get<UserRow[]>('http://localhost:3000/api/admin/instructors').subscribe({
      next: data => {
        this.teachers = data;
        this.updateStats();
      },
      error: () => this.error = 'Failed to load instructors'
    });
  }

  updateStats() {
    this.totalInstructors = this.teachers.length;
    this.activeInstructors = this.teachers.filter(t => t.isOnline).length;
    this.offlineInstructors = this.totalInstructors - this.activeInstructors;
  }

  setStatus(status: string) {
    this.filterStatus = status;
    this.showStatusDropdown = false;
  }

  startEdit(t: UserRow) {
    this.editingTeacherId = t.id;
    this.editModels[t.id] = {
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email,
      phone: t.phone || '',
      status: t.status,
      role: t.role
    } as any;
    this.showEditModal = true;
  }

  cancelEdit(id: string) {
    this.showEditModal = false;
    this.editingTeacherId = null;
    delete this.editModels[id];
  }

  save(id: string) {
    const raw = this.editModels[id];
    const body: any = {};
    Object.keys(raw).forEach(k => {
      const v = (raw as any)[k];
      if (v !== '' && v !== null && v !== undefined) {
        body[k] = v;
      }
    });
    this.http.put(`http://localhost:3000/api/admin/user/${id}`, body).subscribe({
      next: () => {
        this.showEditModal = false;
        this.editingTeacherId = null;
        this.loadTeachers();
        this.success = 'Updated successfully';
        setTimeout(() => this.success = '', 3000);
      },
      error: (err) => {
        console.error('update error', err);
        this.error = 'Failed to update';
      }
    });
  }

  deleteUser(id: string) {
    if (!confirm('Delete this instructor?')) return;
    this.http.delete(`http://localhost:3000/api/admin/user/${id}`).subscribe({
      next: () => this.loadTeachers(),
      error: () => this.error = 'Failed to delete user'
    });
  }

  openAddUserModal() {
    this.addUserError = '';
    this.newUserFirstName = '';
    this.newUserLastName = '';
    this.newUserEmail = '';
    this.newUserPhone = '';
    this.newUserRole = 'instructor';
    this.showAddUserModal = true;
  }

  closeAddUserModal() {
    if (this.addUserLoading) return;
    this.showAddUserModal = false;
  }

  createUser() {
    if (this.addUserLoading) return;
    const first = this.newUserFirstName.trim();
    const last = this.newUserLastName.trim();
    const email = this.newUserEmail.trim();
    const phone = this.newUserPhone.trim();
    if (!first || !last || !email) {
      this.addUserError = 'First name, last name and email are required.';
      return;
    }

    this.addUserLoading = true;
    this.addUserError = '';

    const body: any = {
      first_name: first,
      last_name: last,
      email,
      role: this.newUserRole,
    };
    if (phone) {
      body.phone = phone;
    }

    this.http.post('http://localhost:3000/api/admin/user', body).subscribe({
      next: () => {
        this.addUserLoading = false;
        this.showAddUserModal = false;
        this.loadTeachers();
      },
      error: (err) => {
        console.error('create user error', err);
        this.addUserError = err.error?.message || 'Failed to create user';
        this.addUserLoading = false;
      },
    });
  }
}
