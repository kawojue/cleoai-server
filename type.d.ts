type Role = 'user' | 'ai';

interface Chat {
  role: Role;
  message: {
    url?: string;
    content?: string;
    audio?: string | ArrayBuffer;
  };
  createdAt: Date;
}

interface Client {
  connectedAt: number;
  chatHistory: Array<Chat>;
}
