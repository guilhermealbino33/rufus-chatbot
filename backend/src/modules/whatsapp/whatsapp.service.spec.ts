import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappSession } from "./entities/whatsapp-session.entity";
import { Repository } from "typeorm";

interface MakeSutTypes {
    sut: WhatsappService;
    sessionRepository: jest.Mocked<Repository<WhatsappSession>>;
    eventEmitter: jest.Mocked<EventEmitter2>;
}

const makeSut = (): MakeSutTypes => {
    const sessionRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<WhatsappSession>>;

    const eventEmitter = {
        emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    const sut = new WhatsappService(sessionRepository, eventEmitter);

    return {
        sut,
        sessionRepository,
        eventEmitter,
    };
}