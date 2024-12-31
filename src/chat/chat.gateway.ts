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
import { PromptDTO, SendMessageDTO } from './chat.dto';

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
        role: Role;
        message: {
          url?: string;
          content?: string;
          audio?: string | ArrayBuffer;
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
      return this.chatService.emitError(
        socket,
        HttpStatus.NOT_FOUND,
        'Client not connected',
      );
    }

    if (!body.prompt) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Prompt is required',
      );
    }

    if (body.prompt.length > 150) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Prompt is too large',
      );
    }

    let image = '';

    if (body?.url) {
      const response = this.chatService.validateFile(body.url);

      if (!response.success) {
        return this.chatService.emitError(
          socket,
          response.status,
          response.message,
        );
      }

      image = response.file;
    }

    const userMessage = {
      role: 'user' as Role,
      message: {
        url: image,
        content: body.prompt,
      },
      createdAt: new Date(),
    };

    client.chatHistory.push(userMessage);

    const response = await this.chatService.promptResponse(socket.id, {
      url: image,
      prompt: body.prompt,
    });

    if (!response.success) {
      return this.chatService.emitError(
        socket,
        HttpStatus.UNPROCESSABLE_ENTITY,
        response.message,
      );
    }

    const aiMessage = {
      role: 'ai' as Role,
      createdAt: new Date(),
      message: { content: response.message },
    };

    client.chatHistory.push(aiMessage);

    socket.emit('message-response', { userMessage, aiMessage });
  }

  @SubscribeMessage('generate-image')
  async generateImage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { prompt }: PromptDTO,
  ) {
    const client = this.clients.get(socket);

    if (!client) {
      return this.chatService.emitError(
        socket,
        HttpStatus.NOT_FOUND,
        'Client not connected',
      );
    }

    if (!prompt) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Prompt is required',
      );
    }

    if (prompt.length > 100) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Prompt is too large',
      );
    }

    const userMessage = {
      role: 'user' as Role,
      message: {
        content: prompt,
      },
      createdAt: new Date(),
    };

    client.chatHistory.push(userMessage);

    const response = await this.chatService.imageResponse(socket.id, {
      prompt,
    });

    if (!response.success) {
      return this.chatService.emitError(
        socket,
        HttpStatus.UNPROCESSABLE_ENTITY,
        response.message,
      );
    }

    const aiMessage = {
      role: 'ai' as Role,
      createdAt: new Date(),
      message: { url: response.message },
    };

    client.chatHistory.push(aiMessage);

    socket.emit('image-response', { userMessage, aiMessage });
  }

  @SubscribeMessage('text-to-speech')
  async textToSpeech(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { prompt }: PromptDTO,
  ) {
    const client = this.clients.get(socket);

    if (!client) {
      return this.chatService.emitError(
        socket,
        HttpStatus.NOT_FOUND,
        'Client not connected',
      );
    }

    if (prompt && prompt.length > 150) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Prompt is too large',
      );
    }

    const chatHistory = client.chatHistory;

    if (
      (!prompt && chatHistory.length === 0) ||
      (chatHistory.length > 0 &&
        !chatHistory[chatHistory.length - 1]?.message?.content)
    ) {
      return this.chatService.emitError(
        socket,
        HttpStatus.BAD_REQUEST,
        'Text is required',
      );
    }

    const messageText =
      prompt || chatHistory[chatHistory.length - 1]?.message?.content;

    const userMessage = {
      role: 'user' as Role,
      message: {
        content: messageText,
      },
      createdAt: new Date(),
    };

    client.chatHistory.push(userMessage);

    const response = await this.chatService.textToSpeechResponse(socket.id, {
      prompt: messageText,
    });

    if (!response.success) {
      return this.chatService.emitError(
        socket,
        HttpStatus.UNPROCESSABLE_ENTITY,
        response.message as string,
      );
    }

    const aiMessage = {
      role: 'ai' as Role,
      message: {
        audio: response.message,
      },
      createdAt: new Date(),
    };

    client.chatHistory.push(aiMessage);

    socket.emit('audio-response', { userMessage, aiMessage });
  }

  @SubscribeMessage('fetch-messages')
  fetchMessages(@ConnectedSocket() socket: Socket) {
    const client = this.clients.get(socket);

    if (!client) {
      return this.chatService.emitError(
        socket,
        HttpStatus.NOT_FOUND,
        'Client not connected',
      );
    }

    socket.emit('chat-history', { chatHistory: client.chatHistory });
  }
}
