import {
  MessageBody,
  OnGatewayInit,
  ConnectedSocket,
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { HttpStatus } from '@nestjs/common';
import { SendMessageDTO } from './chat.dto';
import { ChatService } from './chat.service';

@WebSocketGateway({
  transports: ['polling', 'websocket'],
  cors: {
    origin: ['http://localhost:3000', 'https://mycleoai.xyz'],
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;

  private clients: Map<
    Socket,
    {
      connectedAt: number;
      chatHistory: Array<{
        role: 'user' | 'ai';
        content: string;
        createdAt: Date;
      }>;
    }
  > = new Map();
  private maxClients = 5_000;

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.chatService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    if (this.clients.size >= this.maxClients) {
      this.evictOldestClient();
    }

    this.clients.set(client, {
      connectedAt: Date.now(),
      chatHistory: [],
    });

    client.emit('connected', { message: 'Connected' });
  }

  handleDisconnect(client: Socket) {
    client.emit('disconnected', { message: 'Disconnected' });
    this.clients.delete(client);
  }

  private evictOldestClient() {
    let oldestClient: Socket | null = null;
    let oldestTime = Infinity;

    for (const [client, data] of this.clients) {
      if (data.connectedAt < oldestTime) {
        oldestTime = data.connectedAt;
        oldestClient = client;
      }
    }

    if (oldestClient) {
      oldestClient.disconnect(true);
      this.clients.delete(oldestClient);
    }
  }

  @SubscribeMessage('send-message')
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: SendMessageDTO,
  ) {
    const client = this.clients.get(socket);

    if (!client) {
      socket.emit('error', {
        status: HttpStatus.NOT_FOUND,
        message: 'Client not connected',
      });
      return;
    }

    client.chatHistory.push({
      role: 'user',
      content: body.prompt,
      createdAt: new Date(),
    });

    const message = await this.chatService.getTextResponse(socket.id, body);

    client.chatHistory.push({
      role: 'ai',
      content: message,
      createdAt: new Date(),
    });

    socket.emit('message-response', {
      userMessage: body.prompt,
      aiMessage: message,
    });
  }

  @SubscribeMessage('generate-image')
  async generateImage(@ConnectedSocket() socket: Socket) {
    const client = this.clients.get(socket);

    if (!client) {
      socket.emit('error', {
        status: HttpStatus.NOT_FOUND,
        message: 'Client not connected',
      });
      return;
    }
  }

  @SubscribeMessage('fetch-messages')
  fetchMessages(@ConnectedSocket() socket: Socket) {
    const client = this.clients.get(socket);

    if (!client) {
      socket.emit('error', {
        status: HttpStatus.NOT_FOUND,
        message: 'Client not connected',
      });
      return;
    }

    socket.emit('chat-history', { chatHistory: client.chatHistory });
  }
}
