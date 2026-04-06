import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

// ── Shared interfaces ─────────────────────────────────────────────────────
export interface RoomPlayer {
  socketId: string;
  username: string;
  avatar: string; // New: Selected emoji/icon
  userId?: string;
  isHost: boolean;
  joinedAt?: Date;
}

export interface RoomData {
  roomCode: string;
  hostId: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing';
  totalQuestions: number;
}

// ── Service ───────────────────────────────────────────────────────────────
@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private readonly socketUrl = 'http://localhost:3000/brainrush';

  // ── Connect / Disconnect ────────────────────────────────────────────────

  connect(token?: string): void {
    if (this.socket?.connected) return;

    const opts: any = { transports: ['websocket', 'polling'] };
    if (token) {
      opts.extraHeaders = { Authorization: `Bearer ${token}` };
    }

    this.socket = io(this.socketUrl, opts);

    this.socket.on('connect', () =>
      console.log('[SocketService] Connected:', this.socket.id)
    );
    this.socket.on('disconnect', (reason) =>
      console.warn('[SocketService] Disconnected:', reason)
    );
    this.socket.on('connect_error', (err) =>
      console.error('[SocketService] Connection error:', err.message)
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  get socketId(): string {
    return this.socket?.id ?? '';
  }

  // ── Emit events ─────────────────────────────────────────────────────────

  /** Host: create a new room */
  createRoom(username: string, avatar: string, userId?: string, totalQuestions: number = 10): void {
    this.socket?.emit('createRoom', { username, avatar, userId, totalQuestions });
  }

  /** Guest: join an existing room */
  joinRoom(roomCode: string, username: string, avatar: string, userId?: string): void {
    this.socket?.emit('joinRoom', { roomCode, username, avatar, userId });
  }

  /** Host: start the game */
  startGame(roomCode: string, subject: string, difficulty: string, totalQuestions?: number): void {
    this.socket?.emit('startGame', { roomCode, subject, difficulty, totalQuestions });
  }

  /** Multiplayer: submit an answer for the current synchronized question */
  submitAnswer(roomCode: string, answer: string, responseTime: number): void {
    this.socket?.emit('submitAnswer', { roomCode, answer, responseTime });
  }

  /** Legacy score update */
  updateScore(gameSessionId: string, roomCode: string): void {
    this.socket?.emit('updateScore', { gameSessionId, roomCode });
  }

  /** Multiplayer: broadcast this player's final score to the room */
  submitFinalScore(roomCode: string, username: string, avatar: string, score: number, difficulty: string): void {
    this.socket?.emit('submitFinalScore', { roomCode, username, avatar, score, difficulty });
  }

  // ── Listen events ────────────────────────────────────────────────────────

  /** Fired when host successfully creates a room */
  onRoomCreated(): Observable<{ roomCode: string; room: RoomData }> {
    return this.fromEvent('roomCreated');
  }

  /** Fired when a joiner successfully joins */
  onRoomJoined(): Observable<{ roomCode: string; room: RoomData }> {
    return this.fromEvent('roomJoined');
  }

  /** Fired to ALL room members when someone joins */
  onPlayerJoined(): Observable<{ players: RoomPlayer[]; newPlayer: { socketId: string; username: string; avatar: string } }> {
    return this.fromEvent('playerJoined');
  }

  /** Fired to ALL room members when someone leaves */
  onPlayerLeft(): Observable<{ socketId: string; players: RoomPlayer[]; newHostId: string }> {
    return this.fromEvent('playerLeft');
  }

  /** Fired to ALL room members when host starts the game */
  onGameStarted(): Observable<{ roomCode: string; players: RoomPlayer[] }> {
    return this.fromEvent('gameStarted');
  }

  /** Fired on any room-level error */
  onRoomError(): Observable<{ message: string }> {
    return this.fromEvent('roomError');
  }

  /** Leaderboard update */
  onLeaderboardUpdate(): Observable<any> {
    return this.fromEvent('leaderboardUpdate');
  }

  /** Synchronized Question: Fired when server sends next question */
  onNextQuestion(): Observable<{ question: any; index: number; total: number }> {
    return this.fromEvent('nextQuestion');
  }

  /** Fired when ANY player in the room answers */
  onPlayerAnswered(): Observable<{ socketId: string; username: string }> {
    return this.fromEvent('playerAnswered');
  }

  /** Question Ended: Fired when timer hits 0 or all players answer */
  onQuestionResults(): Observable<{ correctAnswer: string; explanation: string; leaderboard: any[] }> {
    return this.fromEvent('questionResults');
  }

  /** Timer Sync: Fired every second from the server */
  onTimerUpdate(): Observable<{ timeLeft: number }> {
    return this.fromEvent('timerUpdate');
  }

  /** Pre-game countdown */
  onGameCountdown(): Observable<{ seconds: number }> {
    return this.fromEvent('gameCountdown');
  }

  /** Synchronized Final Results */
  onFinalResults(): Observable<{ ranking: any[] }> {
    return this.fromEvent('finalResults');
  }

  /** Multiplayer final scores — fires each time a player submits (Legacy) */
  onFinalScores(): Observable<{ scores: any[]; total: number; submitted: number }> {
    return this.fromEvent('finalScores');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (!this.socket) {
        subscriber.error(new Error('Socket not connected'));
        return;
      }
      const handler = (data: T) => subscriber.next(data);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
