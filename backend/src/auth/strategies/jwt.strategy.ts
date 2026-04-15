import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Attach role (and id) from the database so role changes apply without re-login,
   * and guards do not rely on stale JWT claims.
   */
  async validate(payload: { sub?: string; email?: string }) {
    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const user = await this.userModel
      .findById(userId)
      .select('email role')
      .lean()
      .exec();

    if (!user) {
      throw new UnauthorizedException();
    }

    const id = String(user._id);
    return {
      id,
      userId: id,
      _id: user._id,
      email: user.email,
      role: user.role,
    };
  }
}
