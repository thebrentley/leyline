import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { EmailService } from '../email/email.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private emailService: EmailService) {}

  @Post()
  @HttpCode(200)
  async sendFeedback(
    @Body('message') message: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!message?.trim()) {
      return { success: false, error: 'Message is required' };
    }

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #7C3AED;">Leyline Feedback</h2>
        <p><strong>From:</strong> ${user.email}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0;" />
        <p style="white-space: pre-wrap;">${message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
    `;

    const sent = await this.emailService.sendEmail(
      'thebrentley7@gmail.com',
      `Leyline Feedback from ${user.email}`,
      htmlBody,
    );

    return { success: sent };
  }
}
