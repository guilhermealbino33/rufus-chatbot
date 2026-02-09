import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { WhatsappSessionsService } from '../services/';
import { CreateSessionDTO, SearchSessionsDTO, DeleteSessionDTO } from '../dto';

@Controller('whatsapp/sessions')
export class WhatsappController {
  constructor(private readonly service: WhatsappSessionsService) {}

  @Post('')
  async createSession(@Body() createSessionDto: CreateSessionDTO) {
    return this.service.start(createSessionDto.sessionName);
  }

  @Get('')
  async getAllSessions(@Query() searchSessionsDto: SearchSessionsDTO) {
    return this.service.search(searchSessionsDto);
  }

  @Get(':sessionName')
  async getSession(@Param('sessionName') sessionName: string) {
    return this.service.get(sessionName);
  }

  @Get(':sessionName/status')
  async getSessionStatus(@Param('sessionName') sessionName: string) {
    return this.service.getStatus(sessionName);
  }

  @Get(':sessionName/qrcode')
  async getQRCode(@Param('sessionName') sessionName: string) {
    return this.service.getQRCode(sessionName);
  }

  @Delete(':sessionName')
  async deleteSession(@Param('sessionName') { sessionName }: DeleteSessionDTO) {
    return this.service.delete(sessionName);
  }
}
