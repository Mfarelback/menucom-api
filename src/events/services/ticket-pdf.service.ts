import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Ticket } from '../entities/ticket.entity';
import { LoggerService } from '../../core/logger';

@Injectable()
export class TicketPdfService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('TicketPdfService');
  }

  async generateTicketPdf(ticket: Ticket): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A6', margin: 20 });
        const chunks: any[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Título del Evento
        doc
          .fontSize(16)
          .text(ticket.ticketType.event.name, { align: 'center' });
        doc.moveDown();

        // Información del Ticket
        doc.fontSize(10).text(`Tipo: ${ticket.ticketType.name}`);
        doc.text(
          `Fecha: ${new Date(ticket.ticketType.event.startDate).toLocaleDateString()}`,
        );
        doc.text(
          `Lugar: ${ticket.ticketType.event.venue?.name || 'Por confirmar'}`,
        );
        doc.moveDown();

        doc.text(`Asistente: ${ticket.ownerName}`);
        doc.text(`Email: ${ticket.ownerEmail}`);
        doc.moveDown();

        // Generar QR
        const qrDataURL = await QRCode.toDataURL(ticket.qrCode);
        doc.image(qrDataURL, {
          fit: [100, 100],
          align: 'center',
          valign: 'center',
        });

        doc.moveDown();
        doc
          .fillColor('grey')
          .fontSize(8)
          .text(`Código: ${ticket.qrCode}`, { align: 'center' });

        doc.end();
      } catch (error) {
        this.logger.error(`Error generating PDF: ${error instanceof Error ? error.message : String(error)}`);
        reject(error);
      }
    });
  }
}
