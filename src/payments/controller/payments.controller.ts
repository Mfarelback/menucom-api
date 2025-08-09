import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.gards';
import { PaymentsService } from '../services/payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Consulta el estado de un pago',
  })
  @Get('status/:id')
  async getUnabilavleTimeSport(@Req() req: Request, @Param('id') id: string) {
    return this.paymentsService.getPaymentById(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('webhooks')
  async recibeNotification(
    @Body() payload: any,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    console.log(payload);
    console.log(idempotencyKey);
    return 'Get capture of payment' + JSON.stringify(payload) + idempotencyKey;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('checkin/:id')
  async postNewBookingSport(@Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(id);
  }
}
