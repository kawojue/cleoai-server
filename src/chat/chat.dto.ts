export class GenImageDTO {
  prompt: string;
}

export class SendMessageDTO extends GenImageDTO {
  url?: string;
}

export class TextToSpeechDTO {
  text: string;
}
