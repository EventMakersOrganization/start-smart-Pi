import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const user = this.authService.getUser();
    const requiredRoles = ((route.data['roles'] as string[]) || []).map((r) =>
      String(r || '').trim().toLowerCase(),
    );
    const userRole = String(user?.role || '').trim().toLowerCase();

    if (user && userRole && requiredRoles.includes(userRole)) {
      return true;
    } else {
      this.router.navigate([this.resolveDashboardForRole(userRole)]);
      return false;
    }
  }

  private resolveDashboardForRole(role: string): string {
    if (role === 'admin') {
      return '/admin';
    }
    if (role === 'instructor' || role === 'teacher') {
      return '/instructor/dashboard';
    }
    if (role === 'student') {
      return '/student-dashboard';
    }
    return '/login';
  }
}
