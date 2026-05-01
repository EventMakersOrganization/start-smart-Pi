import { TestBed } from '@angular/core/testing';
import { ChatSocketService } from './chat-socket.service';
import * as ioClient from 'socket.io-client';

describe('ChatSocketService', () => {
  let service: ChatSocketService;
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      on: jasmine.createSpy('on'),
      emit: jasmine.createSpy('emit'),
      disconnect: jasmine.createSpy('disconnect'),
      auth: {}
    };

    TestBed.configureTestingModule({
      providers: [ChatSocketService]
    });
    service = TestBed.inject(ChatSocketService);

    // Spy on internal ioFunc
    spyOn(service as any, 'ioFunc').and.returnValue(mockSocket);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should connect and initialize socket', () => {
    localStorage.setItem('authToken', 'test-token');
    service.connect();
    expect((service as any).ioFunc).toHaveBeenCalledWith('http://localhost:3000', {
      auth: { token: 'test-token' }
    });
  });

  it('should not reconnect if already connected', () => {
    service.connect();
    service.connect();
    expect((service as any).ioFunc).toHaveBeenCalledTimes(1);
  });

  it('should disconnect and clear socket', () => {
    service.connect();
    service.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should emit joinRoom', () => {
    service.connect();
    service.joinRoom('ChatRoom', '123');
    expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', { sessionType: 'ChatRoom', sessionId: '123' });
  });

  it('should emit sendMessage', () => {
    service.connect();
    service.sendMessage('ChatRoom', '123', 'hello', []);
    expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', {
      sessionType: 'ChatRoom',
      sessionId: '123',
      content: 'hello',
      attachments: []
    });
  });

  it('should return observable for new messages', (done) => {
    service.connect();
    const mockMsg = { content: 'test' };
    
    // Simulate socket.on('newMessage', callback)
    mockSocket.on.and.callFake((event: string, callback: Function) => {
      if (event === 'newMessage') {
        callback(mockMsg);
      }
    });

    service.onNewMessage().subscribe(msg => {
      expect(msg).toEqual(mockMsg);
      done();
    });
  });
});
