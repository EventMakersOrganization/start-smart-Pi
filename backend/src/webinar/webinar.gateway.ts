import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    WebSocketServer,
    ConnectedSocket,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebinarService } from './webinar.service';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'webinar',
})
export class WebinarGateway implements OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Track which socket is in which webinar for cleanup
    private socketToWebinar = new Map<string, string>();
    private socketToUser = new Map<string, any>();

    constructor(private readonly webinarService: WebinarService) { }

    @SubscribeMessage('joinWebinar')
    async handleJoin(
        @MessageBody() data: { webinarId: string; userId: string; username: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { webinarId, userId, username } = data;

        // Join room
        client.join(webinarId);

        // Track for cleanup
        this.socketToWebinar.set(client.id, webinarId);
        this.socketToUser.set(client.id, { userId, username });

        // Update DB
        await this.webinarService.addParticipant(webinarId, { userId, username });

        // Broadcast to room
        this.server.to(webinarId).emit('userJoined', { userId, username, timestamp: new Date() });

        // Send current participant count (optional but good for UI)
        const webinar = await this.webinarService.findOne(webinarId);
        this.server.to(webinarId).emit('participantsUpdate', webinar.participants);

        console.log(`User ${username} joined webinar ${webinarId}`);
    }

    @SubscribeMessage('sendMessage')
    handleMessage(
        @MessageBody() data: { webinarId: string; userId: string; username: string; message: string },
    ) {
        const { webinarId, username, message, userId } = data;
        const chatMessage = {
            userId,
            username,
            message,
            timestamp: new Date(),
        };

        this.server.to(webinarId).emit('newMessage', chatMessage);
    }

    @SubscribeMessage('sendReaction')
    handleReaction(
        @MessageBody() data: { webinarId: string; userId: string; reaction: string },
    ) {
        this.server.to(data.webinarId).emit('newReaction', {
            userId: data.userId,
            reaction: data.reaction,
        });
    }

    @SubscribeMessage('leaveWebinar')
    async handleLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { webinarId: string; userId: string },
    ) {
        await this.performLeave(client, data.webinarId, data.userId);
    }

    async handleDisconnect(client: Socket) {
        const webinarId = this.socketToWebinar.get(client.id);
        const user = this.socketToUser.get(client.id);

        if (webinarId && user) {
            await this.performLeave(client, webinarId, user.userId);
        }
    }

    private async performLeave(client: Socket, webinarId: string, userId: string) {
        client.leave(webinarId);
        this.socketToWebinar.delete(client.id);
        this.socketToUser.delete(client.id);

        await this.webinarService.removeParticipant(webinarId, userId);

        this.server.to(webinarId).emit('userLeft', { userId, timestamp: new Date() });

        const webinar = await this.webinarService.findOne(webinarId);
        if (webinar) {
            this.server.to(webinarId).emit('participantsUpdate', webinar.participants);
        }
    }

    // WebRTC Signaling
    @SubscribeMessage('webrtc-offer')
    handleOffer(@MessageBody() data: { webinarId: string; offer: any }) {
        // Broadcast offer to everyone in the room except sender (if needed)
        // Usually, the broadcaster sends the offer, and viewers answer.
        this.server.to(data.webinarId).emit('webrtc-offer', data.offer);
    }

    @SubscribeMessage('webrtc-answer')
    handleAnswer(@MessageBody() data: { webinarId: string; answer: any }) {
        this.server.to(data.webinarId).emit('webrtc-answer', data.answer);
    }

    @SubscribeMessage('webrtc-ice-candidate')
    handleIceCandidate(@MessageBody() data: { webinarId: string; candidate: any }) {
        this.server.to(data.webinarId).emit('webrtc-ice-candidate', data.candidate);
    }
}
