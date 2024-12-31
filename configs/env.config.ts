import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), './.env'),
});

export const config = {
  port: parseInt(process.env.PORT, 10) || 2500,
  openAI: {
    apiKey: process.env.OPEN_AI_API_KEY,
    projectID: process.env.OPEN_AI_PROJECT_ID,
    organizationID: process.env.OPEN_AI_ORG_ID,
    maxTokens: parseInt(process.env.MAX_TOKENS, 10),
  },
};
