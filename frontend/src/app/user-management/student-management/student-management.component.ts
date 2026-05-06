import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../core/api-url';

interface UserRow {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  status: string;
  class?: string;
  risk_level?: string;
  points_gamification?: number;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  isOnline?: boolean;
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

  // Stats
  totalStudents = 0;
  activeStudents = 0;
  highRiskStudents = 0;
  avgPoints = 0;

  // filter inputs from template
  filterText = '';
  filterStatus = 'Status: All';
  filterRisk = 'Risk: All';

  showStatusDropdown = false;
  showRiskDropdown = false;

  // edit modal state
  showEditModal = false;
  editingStudentId: string | null = null;
  
  // add-user modal state
  showAddUserModal = false;
  newUserFirstName = '';
  newUserLastName = '';
  newUserEmail = '';
  newUserPhone = '';
  newUserRole: 'student' | 'instructor' | 'admin' = 'student';
  addUserLoading = false;
  addUserError = '';
  newUserClassId = '';
  classes: any[] = [];

  get filteredStudents(): UserRow[] {
    const text = (this.filterText || '').trim().toLowerCase();
    
    return this.students.filter(s => {
      if (text) {
        const firstName = (s.first_name || '').toLowerCase();
        const lastName = (s.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const email = (s.email || '').toLowerCase();
        
        const match =
          firstName.includes(text) ||
          lastName.includes(text) ||
          fullName.includes(text) ||
          email.includes(text);
          
        if (!match) return false;
      }
      
      if (this.filterStatus && this.filterStatus !== 'Status: All') {
        const status = s.status || 'active';
        if (status.toLowerCase() !== this.filterStatus.toLowerCase()) return false;
      }
      
      if (this.filterRisk && this.filterRisk !== 'Risk: All') {
        const risk = s.risk_level || 'LOW';
        const targetRisk = this.filterRisk.replace(' Risk', '').toUpperCase();
        if (risk !== targetRisk) return false;
      }
      
      return true;
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadStudents();
    this.loadClasses();
  }

  loadClasses() {
    this.http.get<any[]>(apiUrl('/api/admin/classes')).subscribe({
      next: data => this.classes = data,
      error: () => console.error('Failed to load classes')
    });
  }

  loadStudents() {
    this.http.get<UserRow[]>(apiUrl('/api/admin/students')).subscribe({
      next: data => this.students = data.map((student: any) => ({
        ...student,
        class: student.class ?? student.academic_level ?? '',
      })),
      error: () => this.error = 'Failed to load students'
    });
  }

  updateStats() {
    this.totalStudents = this.students.length;
    this.activeStudents = this.students.filter(s => (s.status || '').toLowerCase() === 'active').length;
    this.highRiskStudents = this.students.filter(s => s.risk_level === 'HIGH').length;
    
    const totalPoints = this.students.reduce((acc, s) => acc + (s.points_gamification || 0), 0);
    this.avgPoints = this.totalStudents > 0 ? Math.round(totalPoints / this.totalStudents) : 0;
  }

  startEdit(s: UserRow) {
    this.editingStudentId = s.id;
    this.editModels[s.id] = {
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      phone: s.phone || '',
      class: s.class || '',
      risk_level: s.risk_level || 'LOW',
      points_gamification: s.points_gamification || 0,
      status: s.status,
      role: s.role
    } as any;
    this.showEditModal = true;
  }

  cancelEdit(id: string) {
    this.showEditModal = false;
    this.editingStudentId = null;
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
    this.http.put(apiUrl(`/api/admin/user/${id}`), body).subscribe({
      next: () => {
        this.success = 'Updated successfully';
        this.students = this.students.map((student) =>
          student.id === id
            ? { ...student, ...body, class: body.class ?? student.class }
            : student,
        );
        this.showEditModal = false;
        this.editingStudentId = null;
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
    this.http.delete(apiUrl(`/api/admin/user/${id}`)).subscribe({
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
    this.newUserClassId = '';
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
    if (this.newUserClassId) {
      body.classId = this.newUserClassId;
    }

    this.http.post(apiUrl('/api/admin/user'), body).subscribe({
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

  setStatus(status: string) {
    this.filterStatus = status;
    this.showStatusDropdown = false;
  }

  setRisk(risk: string) {
    this.filterRisk = risk;
    this.showRiskDropdown = false;
  }
}
