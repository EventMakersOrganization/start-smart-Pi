import { Module } from '@nestjs/common';
import { CodebattleController } from './codebattle.controller';
import { CodebattleService } from './codebattle.service';
import { CodebattleGateway } from './codebattle.gateway';

@Module({
    controllers: [CodebattleController],
    providers: [CodebattleService, CodebattleGateway],
    exports: [CodebattleService]
})
export class CodebattleModule { }
