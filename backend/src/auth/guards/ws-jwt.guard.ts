import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private logger: Logger = new Logger('WsJwtGuard');

  constructor(private jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const authToken = client.handshake?.auth?.token || client.handshake?.query?.token;

      if (!authToken) {
        this.logger.error('No token found in handshake');
        return false;
      }

      const payload = await this.jwtService.verifyAsync(authToken);
      // Attach user to client for later use
      client.data.user = {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch (err) {
      this.logger.error(`Invalid token: ${err.message}`);
      return false;
    }
  }
}
