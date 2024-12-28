import { OpenAI } from 'openai';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { config } from 'configs/env.config';
import { SendMessageDTO } from './chat.dto';

@Injectable()
export class ChatService {
  private server: Server;
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openAI.apiKey,
      organization: config.openAI.organizationID,
    });
  }

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  async getTextResponse(clientId: string, body: SendMessageDTO) {
    const messages: any[] = [
      {
        role: 'user',
        content: { type: 'text', text: body.prompt },
      },
    ];

    if (body?.url) {
      messages.push({
        role: 'user',
        content: { type: 'image_url', image_url: { url: body.url } },
      });
    }

    const response = await this.openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages,
      user: clientId,
      max_tokens: config.openAI.maxTokens,
    });

    return response.choices[0].message.content;
  }
}
