import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/schemas/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    const actual = user?.role;
    if (actual == null) {
      return false;
    }
    if (Array.isArray(actual)) {
      return actual.some((r) => requiredRoles.includes(r as UserRole));
    }
    if (typeof actual === 'string') {
      return requiredRoles.includes(actual as UserRole);
    }
    return false;
  }
}
