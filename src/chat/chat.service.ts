import { OpenAI } from 'openai';
import { Server, Socket } from 'socket.io';
import { config } from 'configs/env.config';
import { PromptDTO, SendMessageDTO } from './chat.dto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

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

  validateFile(file: string) {
    const maxSize = 524_288;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const { fileSize, fileType } = this.getFileMetadata(file);

    if (fileSize > maxSize) {
      return {
        success: false,
        status: HttpStatus.BAD_REQUEST,
        message: 'File size exceeds limit',
      };
    }

    if (!allowedTypes.includes(fileType)) {
      return {
        success: false,
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        message: 'Unsupported file type',
      };
    }

    return { success: true, file };
  }

  private getFileMetadata(file: string) {
    const match = file.match(/^data:(.*?);base64,/);
    const fileSize = Buffer.byteLength(file, 'base64');
    return { fileType: match ? match[1] : '', fileSize };
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

  async imageResponse(clientId: string, { prompt }: PromptDTO) {
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

  async textToSpeechResponse(clientId: string, { prompt }: PromptDTO) {
    try {
      const promptAnswer = await this.promptResponse(clientId, {
        prompt,
      });

      if (!promptAnswer.success) {
        throw new Error(promptAnswer.message);
      }

      const response = await this.openai.audio.speech.create({
        input: promptAnswer.message,
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
        message: 'Oops! Something went wrong..',
      };
    }
  }

  emitError(socket: Socket, status: HttpStatus, message: string) {
    socket.emit('error', { status, message });
  }
}
