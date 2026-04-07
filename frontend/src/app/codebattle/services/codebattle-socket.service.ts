import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject, Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CodebattleSocketService {
    private socket: Socket;
    private url = 'http://localhost:3000/codebattle';

    private roomSubject = new BehaviorSubject<any>(null);
    room$ = this.roomSubject.asObservable();

    private gameStartedSubject = new BehaviorSubject<any>(null);
    gameStarted$ = this.gameStartedSubject.asObservable();

    private errorSubject = new BehaviorSubject<string>('');
    error$ = this.errorSubject.asObservable();

    get socketId() { return this.socket.id; }

    constructor() {
        this.socket = io(this.url, {
            transports: ['websocket'],
            autoConnect: false
        });

        this.setupListeners();
    }

    connect() {
        if (!this.socket.connected) {
            this.socket.connect();
        }
    }

    disconnect() {
        if (this.socket.connected) {
            this.socket.disconnect();
            this.roomSubject.next(null);
            this.gameStartedSubject.next(null);
            this.errorSubject.next('');
        }
    }

    private setupListeners() {
        this.socket.on('roomCreated', (room) => {
            this.roomSubject.next(room);
        });

        this.socket.on('joinedSuccess', (room) => {
            this.roomSubject.next(room);
        });

        this.socket.on('playerJoined', (room) => {
            this.roomSubject.next(room);
        });

        this.socket.on('gameStarted', (data) => {
            this.gameStartedSubject.next(data);
        });

        this.socket.on('error', (msg) => {
            console.error('Socket Error:', msg);
            this.errorSubject.next(msg);
        });
    }

    onError() { return this.error$; }

    /**
     * Synchronized Game Listeners for Multiplayer
     */
    setupGameListeners(
        onTimer: (timeLeft: number) => void,
        onProblemStarted: (data: any) => void,
        onLeaderboard: (data: any) => void,
        onSubmissionLocked: (data: any) => void,
        onSubmissionProgress: (data: any) => void,
        onRoundResults: (data: any) => void,
        onFinished: (data: any) => void
    ) {
        this.socket.on('timerUpdate', (data) => onTimer(data.timeLeft));
        this.socket.on('problemStarted', (data) => onProblemStarted(data));
        this.socket.on('leaderboardUpdate', (data) => onLeaderboard(data.players));
        this.socket.on('submissionLocked', (data) => onSubmissionLocked(data));
        this.socket.on('submissionProgress', (data) => onSubmissionProgress(data));
        this.socket.on('roundResults', (data) => onRoundResults(data));
        this.socket.on('gameFinished', (data) => onFinished(data));
    }

    createRoom(username: string, config: any) {
        this.socket.emit('createRoom', { username, config });
    }

    joinRoom(roomCode: string, username: string) {
        this.socket.emit('joinRoom', { roomCode, username });
    }

    startGame(roomCode: string) {
        this.socket.emit('startGame', { roomCode });
    }

    submitCode(roomCode: string, code: string, timeLeft: number) {
        this.socket.emit('submitCode', { roomCode, code, timeLeft });
    }
}
