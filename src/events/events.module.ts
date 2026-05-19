import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Event } from './entities/event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketPurchase } from './entities/ticket-purchase.entity';
import { Venue } from './entities/venue.entity';
import { EventsController } from './controllers/events.controller';
import { TicketTypesController } from './controllers/ticket-types.controller';
import { VenuesController } from './controllers/venues.controller';
import { TicketsController } from './controllers/tickets.controller';
import { TicketsWebhookController } from './controllers/tickets-webhook.controller';
import { TicketValidationController } from './controllers/ticket-validation.controller';
import { EventsService } from './services/events.service';
import { TicketTypesService } from './services/ticket-types.service';
import { VenuesService } from './services/venues.service';
import { TicketsService } from './services/tickets.service';
import { TicketPdfService } from './services/ticket-pdf.service';
import { EventPaymentService } from './services/event-payment.service';
import { QRCodeSecureService } from './services/qrcode-secure.service';
import { TicketValidationService } from './services/ticket-validation.service';
import { EventRepository } from './repository/event.repository';
import { TicketTypeRepository } from './repository/ticket-type.repository';
import { VenueRepository } from './repository/venue.repository';
import { TicketRepository } from './repository/ticket.repository';

import { TicketPurchaseRepository } from './repository/ticket-purchase.repository';
import { PaymentsModule } from 'src/payments/payments.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { AuthModule } from 'src/auth/auth.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      TicketType,
      Ticket,
      TicketPurchase,
      Venue,
    ]),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      signOptions: {
        algorithm: 'HS256',
      },
    }),
    forwardRef(() => PaymentsModule),
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [
    EventsController,
    TicketTypesController,
    VenuesController,
    TicketsController,
    TicketsWebhookController,
    TicketValidationController,
  ],
  providers: [
    EventsService,
    TicketTypesService,
    VenuesService,
    TicketsService,
    TicketPdfService,
    EventPaymentService,
    QRCodeSecureService,
    TicketValidationService,
    EventRepository,
    TicketTypeRepository,
    VenueRepository,
    TicketRepository,
    TicketPurchaseRepository,
  ],
  exports: [
    TypeOrmModule,
    EventsService,
    TicketTypesService,
    TicketsService,
    EventPaymentService,
    QRCodeSecureService,
    TicketValidationService,
  ],
})
export class EventsModule {}
