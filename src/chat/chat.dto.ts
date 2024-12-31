export class PromptDTO {
  prompt: string;
}

export class SendMessageDTO extends PromptDTO {
  url?: string;
}
