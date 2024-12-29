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
import { ChatService } from './chat.service';
import { GenImageDTO, SendMessageDTO, TextToSpeechDTO } from './chat.dto';

@WebSocketGateway({
  transports: ['polling', 'websocket'],
  cors: {
    origin: ['http://localhost:3000', 'https://mycleoai.xyz'],
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private clients: Map<
    Socket,
    {
      connectedAt: number;
      chatHistory: Array<{
        role: 'user' | 'ai';
        message: {
          content?: string;
          url?: string;
          audio?: string | Blob;
        };
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

    if (!body.prompt) {
      socket.emit('error', {
        status: HttpStatus.BAD_REQUEST,
        message: 'Prompt is required',
      });
      return;
    }

    if (body.prompt.length > 150) {
      socket.emit('error', {
        status: HttpStatus.BAD_REQUEST,
        message: 'Prompt is too large',
      });
      return;
    }

    client.chatHistory.push({
      role: 'user',
      message: {
        url: body.url,
        content: body.prompt,
      },
      createdAt: new Date(),
    });

    const response = await this.chatService.promptResponse(socket.id, body);

    if (!response.success) {
      socket.emit('error', {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: response.message,
      });
      return;
    }

    client.chatHistory.push({
      role: 'ai',
      createdAt: new Date(),
      message: { content: response.message },
    });

    socket.emit('message-response', {
      userMessage: body.prompt,
      aiMessage: response.message,
    });
  }

  @SubscribeMessage('generate-image')
  async generateImage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { prompt }: GenImageDTO,
  ) {
    const client = this.clients.get(socket);

    if (!client) {
      socket.emit('error', {
        status: HttpStatus.NOT_FOUND,
        message: 'Client not connected',
      });
      return;
    }

    if (!prompt) {
      socket.emit('error', {
        status: HttpStatus.BAD_REQUEST,
        message: 'Prompt is required',
      });
      return;
    }

    if (prompt.length > 100) {
      socket.emit('error', {
        status: HttpStatus.BAD_REQUEST,
        message: 'Prompt is too large',
      });
      return;
    }

    client.chatHistory.push({
      role: 'user',
      message: {
        content: prompt,
      },
      createdAt: new Date(),
    });

    const response = await this.chatService.imageResponse(socket.id, {
      prompt,
    });

    if (!response.success) {
      socket.emit('error', {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: response.message,
      });
      return;
    }

    client.chatHistory.push({
      role: 'ai',
      createdAt: new Date(),
      message: { content: response.message },
    });

    socket.emit('image-response', {
      userMessage: prompt,
      aiMessage: response.message,
    });
  }

  @SubscribeMessage('text-to-speech')
  async textToSpeech(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { text }: TextToSpeechDTO,
  ) {
    const client = this.clients.get(socket);

    if (!client) {
      socket.emit('error', {
        status: HttpStatus.NOT_FOUND,
        message: 'Client not connected',
      });
      return;
    }

    const chatHistory = client.chatHistory;

    if (
      (!text && chatHistory.length === 0) ||
      (chatHistory.length > 0 &&
        !chatHistory[chatHistory.length - 1]?.message?.content)
    ) {
      socket.emit('error', {
        status: HttpStatus.BAD_REQUEST,
        message: 'Text is required',
      });
      return;
    }

    text = text || chatHistory[chatHistory.length - 1]?.message?.content;

    const response = await this.chatService.textToSpeechResponse({ text });

    if (!response.success) {
      socket.emit('error', {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: response.message,
      });
      return;
    }

    client.chatHistory.push({
      role: 'ai',
      message: {
        audio: response.message,
      },
      createdAt: new Date(),
    });

    socket.emit('audio-response', {
      userMessage: null,
      aiMessage: response.message,
    });
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
