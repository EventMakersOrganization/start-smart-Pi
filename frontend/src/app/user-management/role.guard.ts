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
    const requiredRoles = route.data['roles'] as string[];

    if (user && requiredRoles.includes(user.role)) {
      return true;
    } else {
      this.router.navigate(['/profile']);
      return false;
    }
  }
}
