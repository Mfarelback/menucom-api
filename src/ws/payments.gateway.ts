import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');

@WebSocketGateway({ cors: { origin: allowedOrigins, credentials: true } })
export class PaymentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no auth token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.data.userId = payload.sub;
      client.data.role = payload.username;
      this.logger.log(`Client ${client.id} authenticated as user ${payload.sub}`);
    } catch {
      this.logger.warn(`Client ${client.id} disconnected: invalid auth token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribeToOrder')
  handleSubscribe(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
        this.logger.warn(
          `Invalid orderId received from client ${client.id}: ${orderId}`,
        );
        return { error: 'Invalid orderId' };
      }
      client.join(orderId);
      this.logger.log(`Client ${client.id} subscribed to order ${orderId}`);
      return { message: `Subscribed to order ${orderId}` };
    } catch (error) {
      this.logger.error(
        `Error subscribing client ${client.id} to order ${orderId}: ${error}`,
      );
      return { error: 'Subscription failed' };
    }
  }

  emitPaymentSuccess(orderId: string) {
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      this.logger.warn(`emitPaymentSuccess: Invalid orderId: ${orderId}`);
      return;
    }
    this.logger.log(`Emitting paymentSuccess for order ${orderId}`);
    this.server.to(orderId).emit('paymentSuccess', { orderId });
  }
}
