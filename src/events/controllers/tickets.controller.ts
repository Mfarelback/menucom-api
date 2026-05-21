import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt.auth.gards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  RequirePermissions,
  InBusinessContext,
} from '../../auth/decorators/permissions.decorator';
import {
  Permission,
  BusinessContext,
} from '../../auth/models/permissions.model';
import { UserRoleService } from '../../auth/services/user-role.service';
import { TicketsService } from '../services/tickets.service';
import { TicketPdfService } from '../services/ticket-pdf.service';
import { EventPaymentService } from '../services/event-payment.service';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketPdfService: TicketPdfService,
    private readonly eventPaymentService: EventPaymentService,
    private readonly userRoleService: UserRoleService,
  ) {}

  @Post('purchase')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @InBusinessContext(BusinessContext.EVENTS)
  @RequirePermissions(Permission.MANAGE_TICKETS)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generación directa de tickets (solo organizadores)',
    description:
      'Genera tickets sin proceso de pago. Requiere permisos de organizador o administrador. Útil para tickets gratuitos, cortesía o uso interno.',
  })
  async purchase(
    @Body()
    body: {
      ticketTypeId: string;
      quantity: number;
      customerName: string;
      customerEmail: string;
    },
  ) {
    return await this.ticketsService.generateTickets(
      body.ticketTypeId,
      body.quantity,
      body.customerName,
      body.customerEmail,
    );
  }

  @Post('checkout')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Iniciar proceso de pago para tickets' })
  async checkout(
    @Body()
    body: {
      ticketTypeId: string;
      quantity: number;
      customerName: string;
      customerEmail: string;
    },
  ) {
    return await this.eventPaymentService.createTicketPreference(
      body.ticketTypeId,
      body.quantity,
      body.customerName,
      body.customerEmail,
    );
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar el ticket en formato PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const ticket = await this.ticketsService.findOneWithPurchase(id);

    const isBuyer = ticket.purchase?.buyer?.id === req.user.userId;
    const isOrganizer = await this.userRoleService.userHasPermission(
      req.user.userId,
      BusinessContext.EVENTS,
      Permission.MANAGE_TICKETS,
    );

    if (!isBuyer && !isOrganizer) {
      throw new ForbiddenException(
        'No tienes permiso para descargar este ticket',
      );
    }

    const buffer = await this.ticketPdfService.generateTicketPdf(ticket);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=ticket-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Post('validate/:code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validar y consumir un ticket por su código QR (Fase 4)',
  })
  async validate(@Param('code') code: string, @Request() req: any) {
    const validatorId = req.user?.userId || req.user?.id;
    const ticket = await this.ticketsService.validateAndUse(code, validatorId);
    return {
      valid: true,
      message: 'Ticket validado y consumido exitosamente',
      ticket,
    };
  }
}
