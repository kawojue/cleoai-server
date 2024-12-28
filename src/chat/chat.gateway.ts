import {
  OnGatewayInit,
  WebSocketServer,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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

  private clients: Map<Socket, { connectedAt: number; lastChat?: string }> =
    new Map();
  private maxClients = 5_000;

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.chatService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    if (this.clients.size >= this.maxClients) {
      this.evictOldestClient();
    }

    this.clients.set(client, { connectedAt: Date.now() });

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
}
