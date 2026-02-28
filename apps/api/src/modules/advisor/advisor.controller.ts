import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';
import { AdvisorService } from './advisor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  deckId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message: string;

  @IsOptional()
  includeCollection?: boolean;

  @IsOptional()
  skipPersist?: boolean;
}

class UpdateChangeStatusDto {
  @IsString()
  @IsNotEmpty()
  changeId: string;

  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';
}

class BulkUpdateChangesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  changeIds: string[];

  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';
}

@Controller('advisor')
@UseGuards(JwtAuthGuard)
export class AdvisorController {
  constructor(private advisorService: AdvisorService) {}

  @Get('sessions/:deckId')
  async getSessions(
    @Param('deckId') deckId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.advisorService.getSessions(deckId, user.userId);
  }

  @Get('session/:id')
  async getSession(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.advisorService.getSession(id, user.userId);
  }

  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.advisorService.createSession(dto.deckId, user.userId, dto.name);
  }

  @Post('chat/:sessionId')
  async chat(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    return this.advisorService.chat(
      sessionId,
      user.userId,
      dto.message,
      res,
      dto.includeCollection,
      dto.skipPersist,
    );
  }

  @Put('session/:sessionId/change')
  async updateChangeStatus(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateChangeStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.advisorService.updateChangeStatus(
      sessionId,
      user.userId,
      dto.changeId,
      dto.status,
    );
  }

  @Put('session/:sessionId/changes/bulk')
  async bulkUpdateChanges(
    @Param('sessionId') sessionId: string,
    @Body() dto: BulkUpdateChangesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.advisorService.bulkUpdateChangeStatus(
      sessionId,
      user.userId,
      dto.changeIds,
      dto.status,
    );
  }

  @Delete('session/:sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.advisorService.deleteSession(sessionId, user.userId);
    return { success: true };
  }
}
