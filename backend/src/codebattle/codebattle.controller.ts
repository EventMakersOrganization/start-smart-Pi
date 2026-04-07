import { Controller, Post, Body, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { CodebattleService } from './codebattle.service';

@Controller('codebattle')
export class CodebattleController {
    constructor(private readonly codebattleService: CodebattleService) { }

    @Post('solo/start')
    startSolo(@Body() body: { difficulty: string; count: number; userId: string }) {
        try {
            const session = this.codebattleService.startSoloSession(body.userId, body.difficulty, body.count);
            return {
                success: true,
                session
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('solo/run')
    runSolo(@Body() body: { code: string, language: string }) {
        return this.codebattleService.runSoloCode(body.code, body.language);
    }

    @Post('solo/execute')
    executeSolo(@Body() body: { sessionId: string; code: string; language: string }) {
        try {
            const result = this.codebattleService.executeSoloSolution(body.sessionId, body.code, body.language);
            return {
                success: true,
                ...result
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.NOT_FOUND);
        }
    }

    @Post('solo/submit')
    submitSolo(@Body() body: { sessionId: string; code: string; timeLeft: number; language: string }) {
        try {
            const result = this.codebattleService.submitSoloSolution(body.sessionId, body.code, body.timeLeft, body.language);
            return {
                success: true,
                ...result
            };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.NOT_FOUND);
        }
    }

    @Get('room/:roomCode')
    getRoom(@Param('roomCode') roomCode: string) {
        const room = this.codebattleService.getRoom(roomCode);
        if (!room) throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
        return {
            success: true,
            room
        };
    }
}
