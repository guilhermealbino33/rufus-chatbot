import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappController } from '../src/modules/whatsapp/controllers/whatsapp-sessions.controller';
import { WhatsappSessionsService } from '../src/modules/whatsapp/services/whatsapp-sessions.service';
import { WhatsappClientManager } from '../src/modules/whatsapp/providers/whatsapp-client.manager';
import { WhatsappClientFactory } from '../src/modules/whatsapp/providers/whatsapp-client.factory';
import { WhatsappClientConfig } from '../src/modules/whatsapp/config/whatsapp-client.config';
import { SessionStatus } from '../src/modules/whatsapp/enums/whatsapp.enum';
import { WhatsappSession } from '../src/modules/whatsapp/entities/whatsapp-session.entity';
import { WebhookService } from '../src/shared/services/webhook.service';

describe('WhatsappSessions (e2e component)', () => {
  let app: INestApplication;

  // Mock Repository
  const mockSessionRepository = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((session) => Promise.resolve(session)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  // Mock WhatsappClientManager
  const mockClientManager = {
    hasClient: jest.fn().mockReturnValue(false),
    isClientInitializing: jest.fn().mockReturnValue(false),
    isClientConnected: jest.fn().mockReturnValue(false),
    createClient: jest.fn().mockImplementation((sessionName, config: WhatsappClientConfig) => {
      // simulate callbacks firing during initialization
      setTimeout(() => {
        if (config.onLinkCode) {
          config.onLinkCode('TEST-CODE-1234');
        }
        if (config.onStatusChange) {
          config.onStatusChange(SessionStatus.CONNECTING, sessionName);
        }
      }, 50);

      const mockClient = {
        onMessage: jest.fn(),
        close: jest.fn().mockResolvedValue(true),
        isConnected: jest.fn().mockResolvedValue(true),
        getConnectionState: jest.fn().mockResolvedValue('CONNECTED'),
      };

      // Delay resolution so callbacks can run first
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(mockClient);
        }, 100);
      });
    }),
    getClient: jest.fn(),
    removeClient: jest.fn(),
    forceCloseClient: jest.fn(),
    getConnectionState: jest.fn(),
  };

  const mockClientFactory = {
    create: jest.fn(),
  };

  const mockWebhookService = {
    emitMessageReceived: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [
        WhatsappSessionsService,
        {
          provide: getRepositoryToken(WhatsappSession),
          useValue: mockSessionRepository,
        },
        {
          provide: WhatsappClientManager,
          useValue: mockClientManager,
        },
        {
          provide: WhatsappClientFactory,
          useValue: mockClientFactory,
        },
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/whatsapp/sessions (POST) should return pairing code', async () => {
    const sessionName = 'test-pairing-e2e-' + Date.now();
    const phoneNumber = '5511999999999';

    // Ensure mock repository finds no existing session
    mockSessionRepository.findOne.mockResolvedValue(null);

    return request(app.getHttpServer())
      .post('/whatsapp/sessions')
      .send({
        sessionName,
        pairingMode: 'phone',
        phoneNumber,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('CONNECTING');
        expect(res.body.code).toBe('TEST-CODE-1234');
      });
  });
});
