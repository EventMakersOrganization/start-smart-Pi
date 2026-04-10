import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WebinarService } from '../../services/webinar.service';
import { AuthService } from '../../../user-management/auth.service';
import { Webinar, ChatMessage } from '../../services/webinar.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-webinar-live',
    templateUrl: './webinar-live.component.html',
    styleUrls: ['./webinar-live.component.css']
})
export class WebinarLiveComponent implements OnInit, OnDestroy {
    webinarId!: string;
    webinar: Webinar | null = null;
    currentUser: any;

    messages: ChatMessage[] = [];
    newMessageText: string = '';
    participants: any[] = [];
    reactions: any[] = [];

    // WebRTC & Recording
    localStream?: MediaStream;
    peerConnection?: RTCPeerConnection;
    isBroadcasting = false;
    isRecording = false;
    isMicMuted = false;
    isCameraOff = false;
    isScreenSharing = false;

    private screenStream?: MediaStream;
    private mediaRecorder?: MediaRecorder;
    private recordedChunks: Blob[] = [];

    private subs = new Subscription();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private webinarService: WebinarService,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.webinarId = this.route.snapshot.params['id'];
        this.currentUser = this.authService.getUser();

        if (!this.currentUser) {
            this.router.navigate(['/login']);
            return;
        }

        this.loadWebinar();
        this.setupSocket();
    }

    ngOnDestroy(): void {
        if (this.currentUser) {
            this.webinarService.disconnect(this.webinarId, this.currentUser.id);
        }
        this.subs.unsubscribe();
    }

    loadWebinar() {
        this.webinarService.getWebinarById(this.webinarId).subscribe(data => {
            this.webinar = data;
            if (data.status === 'ended') {
                this.router.navigate(['/webinar/list']);
            }
        });
    }

    setupSocket() {
        this.webinarService.connect(this.webinarId, {
            userId: this.currentUser.id,
            username: this.currentUser.first_name || this.currentUser.name || 'User'
        });

        this.subs.add(this.webinarService.messages$.subscribe(msg => {
            this.messages.push(msg);
            this.scrollToBottom();
        }));

        this.subs.add(this.webinarService.participants$.subscribe(list => {
            this.participants = list;
        }));

        this.subs.add(this.webinarService.reactions$.subscribe(reaction => {
            this.showReaction(reaction);
        }));

        this.setupWebRTC();
    }

    // WebRTC Logic
    async setupWebRTC() {
        const isInstructor = this.currentUser.role === 'admin' || this.currentUser.role === 'instructor';

        if (isInstructor) {
            // Broadcaster side
            this.subs.add(this.webinarService.webrtcAnswer$.subscribe(async answer => {
                if (this.peerConnection) await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }));
        } else {
            // Viewer side
            this.subs.add(this.webinarService.webrtcOffer$.subscribe(async offer => {
                await this.initPeerConnection();
                await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await this.peerConnection!.createAnswer();
                await this.peerConnection!.setLocalDescription(answer);
                this.webinarService.sendWebrtcAnswer(this.webinarId, answer);
            }));
        }

        this.subs.add(this.webinarService.webrtcIceCandidate$.subscribe(async candidate => {
            if (this.peerConnection) await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }));
    }

    async initPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.webinarService.sendWebrtcIceCandidate(this.webinarId, event.candidate);
            }
        };

        this.peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
            if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        };
    }

    async startBroadcast() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
            if (localVideo) localVideo.srcObject = this.localStream;

            await this.initPeerConnection();
            this.localStream.getTracks().forEach(track => this.peerConnection!.addTrack(track, this.localStream!));

            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);
            this.webinarService.sendWebrtcOffer(this.webinarId, offer);

            this.isBroadcasting = true;
        } catch (err) {
            console.error('Error starting broadcast:', err);
        }
    }

    toggleMic() {
        if (!this.localStream) return;
        this.isMicMuted = !this.isMicMuted;
        this.localStream.getAudioTracks().forEach(track => track.enabled = !this.isMicMuted);
    }

    toggleCamera() {
        if (!this.localStream) return;
        this.isCameraOff = !this.isCameraOff;
        this.localStream.getVideoTracks().forEach(track => track.enabled = !this.isCameraOff);
    }

    async toggleScreenShare() {
        if (!this.localStream || !this.peerConnection) return;

        try {
            if (!this.isScreenSharing) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = this.screenStream.getVideoTracks()[0];

                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);

                const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
                if (localVideo) localVideo.srcObject = this.screenStream;

                screenTrack.onended = () => this.toggleScreenShare(); // Auto switch back if user stops via browser UI
                this.isScreenSharing = true;
            } else {
                const videoTrack = this.localStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(videoTrack);

                const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
                if (localVideo) localVideo.srcObject = this.localStream;

                this.screenStream?.getTracks().forEach(t => t.stop());
                this.isScreenSharing = false;
            }
        } catch (err) {
            console.error('Screen share error:', err);
        }
    }

    // Recording Logic
    startRecording() {
        if (!this.localStream) return;
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.localStream);
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) this.recordedChunks.push(event.data);
        };
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `webinar-${this.webinarId}-recording.webm`;
            a.click();
        };
        this.mediaRecorder.start();
        this.isRecording = true;
    }

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }

    sendMessage() {
        if (this.newMessageText.trim()) {
            this.webinarService.sendMessage(this.webinarId, {
                userId: this.currentUser.id,
                username: this.currentUser.first_name || this.currentUser.name
            }, this.newMessageText);
            this.newMessageText = '';
        }
    }

    sendReaction(type: string) {
        this.webinarService.sendReaction(this.webinarId, this.currentUser.id, type);
    }

    private showReaction(reaction: any) {
        // Basic logic for reaction animation
        this.reactions.push({ ...reaction, id: Date.now() });
        setTimeout(() => {
            this.reactions = this.reactions.filter(r => r.id !== reaction.id);
        }, 3000);
    }

    private scrollToBottom() {
        setTimeout(() => {
            const chatBox = document.querySelector('.chat-history');
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
    }
}
