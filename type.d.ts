interface UploadOption {
  file: Express.Multer.File | Buffer;
  folder: string;
  maxSize?: number;
  public_id?: string;
  mimeTypes?: string[];
}
