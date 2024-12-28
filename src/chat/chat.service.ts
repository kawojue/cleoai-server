import { OpenAI } from 'openai';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { config } from 'configs/env.config';

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

  async getResponseFromOpenAI(clientId: string, prompt: string) {
    const hehe = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [],
      user: clientId,
    });

    return hehe;
  }
}
