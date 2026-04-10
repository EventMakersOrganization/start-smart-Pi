import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Webinar, ChatMessage } from './webinar.interface';
import { io, Socket } from 'socket.io-client';

@Injectable({
    providedIn: 'root'
})
export class WebinarService {
    private apiUrl = 'http://localhost:3000';
    private socket!: Socket;

    private messageSubject = new Subject<ChatMessage>();
    public messages$ = this.messageSubject.asObservable();

    private participantsSubject = new Subject<any[]>();
    public participants$ = this.participantsSubject.asObservable();

    private reactionSubject = new Subject<{ userId: string, reaction: string }>();
    public reactions$ = this.reactionSubject.asObservable();

    private webrtcOfferSubject = new Subject<any>();
    public webrtcOffer$ = this.webrtcOfferSubject.asObservable();

    private webrtcAnswerSubject = new Subject<any>();
    public webrtcAnswer$ = this.webrtcAnswerSubject.asObservable();

    private webrtcIceCandidateSubject = new Subject<any>();
    public webrtcIceCandidate$ = this.webrtcIceCandidateSubject.asObservable();

    constructor(private http: HttpClient) { }

    // REST API
    getWebinars(): Observable<Webinar[]> {
        return this.http.get<Webinar[]>(`${this.apiUrl}/api/webinars`);
    }

    getWebinarById(id: string): Observable<Webinar> {
        return this.http.get<Webinar>(`${this.apiUrl}/api/webinars/${id}`);
    }

    createWebinar(webinar: any): Observable<Webinar> {
        return this.http.post<Webinar>(`${this.apiUrl}/api/webinars`, webinar);
    }

    // Socket.io
    connect(webinarId: string, user: { userId: string, username: string }) {
        this.socket = io(`${this.apiUrl}/webinar`, {
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            this.socket.emit('joinWebinar', { webinarId, ...user });
        });

        this.socket.on('newMessage', (msg: ChatMessage) => {
            this.messageSubject.next(msg);
        });

        this.socket.on('participantsUpdate', (participants: any[]) => {
            this.participantsSubject.next(participants);
        });

        this.socket.on('newReaction', (reaction: any) => {
            this.reactionSubject.next(reaction);
        });

        this.socket.on('webrtc-offer', (offer: any) => {
            this.webrtcOfferSubject.next(offer);
        });

        this.socket.on('webrtc-answer', (answer: any) => {
            this.webrtcAnswerSubject.next(answer);
        });

        this.socket.on('webrtc-ice-candidate', (candidate: any) => {
            this.webrtcIceCandidateSubject.next(candidate);
        });
    }

    sendWebrtcOffer(webinarId: string, offer: any) {
        if (this.socket) this.socket.emit('webrtc-offer', { webinarId, offer });
    }

    sendWebrtcAnswer(webinarId: string, answer: any) {
        if (this.socket) this.socket.emit('webrtc-answer', { webinarId, answer });
    }

    sendWebrtcIceCandidate(webinarId: string, candidate: any) {
        if (this.socket) this.socket.emit('webrtc-ice-candidate', { webinarId, candidate });
    }

    sendMessage(webinarId: string, user: { userId: string, username: string }, message: string) {
        if (this.socket) {
            this.socket.emit('sendMessage', { webinarId, ...user, message });
        }
    }

    sendReaction(webinarId: string, userId: string, reaction: string) {
        if (this.socket) {
            this.socket.emit('sendReaction', { webinarId, userId, reaction });
        }
    }

    disconnect(webinarId: string, userId: string) {
        if (this.socket) {
            this.socket.emit('leaveWebinar', { webinarId, userId });
            this.socket.disconnect();
        }
    }
}
