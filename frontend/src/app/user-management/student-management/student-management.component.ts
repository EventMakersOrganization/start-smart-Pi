import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface UserRow {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  status: string;
  academic_level?: string;
  risk_level?: string;
  points_gamification?: number;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  // password is only used for admin-set resets, never read from backend
  password?: string;
}

@Component({
  selector: 'app-student-management',
  templateUrl: './student-management.component.html',
  styleUrls: []
})
export class StudentManagementComponent implements OnInit {
  students: UserRow[] = [];
  editing: Record<string, boolean> = {};
  editModels: Record<string, Partial<UserRow>> = {};
  error = '';
  success = '';

  // filter inputs from template
  filterText = '';
  filterStatus = 'Status: All';

  // add-user modal state
  showAddUserModal = false;
  newUserFirstName = '';
  newUserLastName = '';
  newUserEmail = '';
  newUserPhone = '';
  newUserRole: 'student' | 'instructor' | 'admin' = 'student';
  addUserLoading = false;
  addUserError = '';

  get filteredStudents(): UserRow[] {
    return this.students.filter(s => {
      const text = this.filterText.toLowerCase();
      if (text) {
        const match =
          s.first_name?.toLowerCase().includes(text) ||
          s.last_name?.toLowerCase().includes(text) ||
          s.email.toLowerCase().includes(text);
        if (!match) return false;
      }
      if (this.filterStatus !== 'Status: All') {
        if (s.status.toLowerCase() !== this.filterStatus.toLowerCase()) return false;
      }
      return true;
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.http.get<UserRow[]>('http://localhost:3000/api/admin/students').subscribe({
      next: data => this.students = data,
      error: () => this.error = 'Failed to load students'
    });
  }

  startEdit(s: UserRow) {
    this.editing[s.id] = true;
    this.editModels[s.id] = {
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      phone: s.phone || '',
      academic_level: s.academic_level || '',
      risk_level: s.risk_level || 'LOW',
      points_gamification: s.points_gamification || 0,
      status: s.status,
      role: s.role
    } as any;
  }

  cancelEdit(id: string) {
    delete this.editing[id];
    delete this.editModels[id];
  }

  save(id: string) {
    // clone and strip empty values to satisfy backend validation
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
        this.success = 'Updated successfully';
        this.cancelEdit(id);
        this.loadStudents();
        setTimeout(() => this.success = '', 3000);
      },
      error: (err) => {
        console.error('update error', err);
        this.error = 'Failed to update';
      }
    });
  }

  deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    this.http.delete(`http://localhost:3000/api/admin/user/${id}`).subscribe({
      next: () => this.loadStudents(),
      error: () => this.error = 'Failed to delete user'
    });
  }

  openAddUserModal() {
    this.addUserError = '';
    this.newUserFirstName = '';
    this.newUserLastName = '';
    this.newUserEmail = '';
    this.newUserPhone = '';
    this.newUserRole = 'student';
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
        this.loadStudents();
      },
      error: (err) => {
        console.error('create user error', err);
        this.addUserError = err.error?.message || 'Failed to create user';
        this.addUserLoading = false;
      },
    });
  }
}
