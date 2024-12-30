import { OpenAI } from 'openai';
import { Server, Socket } from 'socket.io';
import { config } from 'configs/env.config';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GenImageDTO, SendMessageDTO, TextToSpeechDTO } from './chat.dto';

@Injectable()
export class ChatService {
  private logger = new Logger(ChatService.name);

  private server: Server;
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openAI.apiKey,
      project: config.openAI.projectID,
      organization: config.openAI.organizationID,
    });
  }

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  async promptResponse(clientId: string, body: SendMessageDTO) {
    const messages: any[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: body.prompt }],
      },
    ];

    if (body?.url) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: body.url,
              detail: 'low',
            },
          },
        ],
      });
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        user: clientId,
        max_tokens: config.openAI.maxTokens,
      });

      return {
        success: true,
        message: response.choices[0].message.content,
      };
    } catch (err) {
      this.logger.error(err);
      return {
        success: false,
        message: 'Error getting response',
      };
    }
  }

  async imageResponse(clientId: string, { prompt }: GenImageDTO) {
    try {
      const response = await this.openai.images.generate({
        n: 1,
        prompt: prompt,
        user: clientId,
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });

      return {
        success: true,
        message: response.data[0].url,
      };
    } catch (err) {
      this.logger.error(err);
      return {
        success: false,
        message: 'Error generating image',
      };
    }
  }

  async textToSpeechResponse({ text }: TextToSpeechDTO) {
    try {
      const response = await this.openai.audio.speech.create({
        input: text,
        voice: 'nova',
        model: 'tts-1',
        response_format: 'aac',
      });

      return {
        success: true,
        message: await response.arrayBuffer(),
      };
    } catch (err) {
      this.logger.error(err);
      return {
        success: false,
        message: 'An error occured',
      };
    }
  }

  emitError(socket: Socket, status: HttpStatus, message: string) {
    socket.emit('error', { status, message });
  }
}
