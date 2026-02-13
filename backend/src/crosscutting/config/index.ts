import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env from the root of the project
dotenv.config({ path: join(__dirname, '../../../../.env') });

export const config = {
  whatsapp: {
    testPhoneNumber: process.env.WHATSAPP_TEST_PHONE_NUMBER || '5511999999999',
  },
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    name: process.env.DATABASE_NAME || 'rufus_chatbot',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },
};
