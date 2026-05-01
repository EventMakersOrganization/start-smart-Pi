import { TestBed } from '@angular/core/testing';
import { ChatSocketService } from './chat-socket.service';

describe('ChatSocketService (member5)', () => {
  let service: ChatSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ChatSocketService] });
    service = TestBed.inject(ChatSocketService);
  });

  it('connect/disconnect are safe to call without socket implementation', () => {
    // Should not throw even if socket.io-client is not actually connected during unit test
    expect(() => service.connect()).not.toThrow();
    expect(() => service.disconnect()).not.toThrow();
  });

  it('emits join/send/delete events through the socket', () => {
    const emitted: Array<{ event: string; payload: any }> = [];
    (service as any).socket = {
      emit: (event: string, payload: any) => emitted.push({ event, payload }),
    };

    service.joinRoom('ChatRoom', 'room-1');
    service.sendMessage('ChatRoom', 'room-1', 'hello', []);
    service.deleteMessage('msg-1', 'room-1');

    expect(emitted).toEqual([
      { event: 'joinRoom', payload: { sessionType: 'ChatRoom', sessionId: 'room-1' } },
      { event: 'sendMessage', payload: { sessionType: 'ChatRoom', sessionId: 'room-1', content: 'hello', attachments: [] } },
      { event: 'deleteMessage', payload: { messageId: 'msg-1', sessionId: 'room-1' } },
    ]);
  });

  it('onNewMessage forwards socket events to subscribers', (done) => {
    (service as any).socket = {
      on: (_event: string, handler: (data: any) => void) => handler({ id: 'm1' }),
    };

    service.onNewMessage().subscribe((msg) => {
      expect(msg).toEqual({ id: 'm1' });
      done();
    });
  });
});
