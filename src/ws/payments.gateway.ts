import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway para pagos.
 *
 * Eventos:
 * - subscribeToOrder: El frontend se suscribe a actualizaciones de una orden específica.
 * - paymentSuccess: El backend emite este evento cuando el pago se confirma exitosamente.
 *
 * Ejemplo de uso en frontend:
 *
 * socket.emit('subscribeToOrder', orderId);
 * socket.on('paymentSuccess', (data) => { ... });
 *
 * ---
 *
 * Ejemplo de conexión desde Flutter/Dart:
 *
 * ```dart
 * import 'package:socket_io_client/socket_io_client.dart' as IO;
 *
 * void main() {
 *   IO.Socket socket = IO.io('http://TU_BACKEND_URL:PUERTO', <String, dynamic>{
 *     'transports': ['websocket'],
 *     'autoConnect': false,
 *   });
 *
 *   socket.connect();
 *
 *   socket.onConnect((_) {
 *     print('Conectado al gateway de pagos');
 *     socket.emit('subscribeToOrder', 'ORDER_ID_AQUI');
 *   });
 *
 *   socket.on('paymentSuccess', (data) {
 *     print('Pago exitoso para la orden: \\${data['orderId']}');
 *   });
 *
 *   socket.onDisconnect((_) => print('Desconectado del gateway de pagos'));
 * }
 * ```
 */
@WebSocketGateway({ cors: true })
export class PaymentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * El frontend puede suscribirse a eventos de pago por orderId
   * @param orderId ID de la orden a escuchar
   */
  @SubscribeMessage('subscribeToOrder')
  handleSubscribe(@MessageBody() orderId: string, client: Socket) {
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

  /**
   * Emitir evento de pago exitoso a los clientes suscritos a la orden
   * @param orderId ID de la orden pagada
   */
  emitPaymentSuccess(orderId: string) {
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      this.logger.warn(`emitPaymentSuccess: Invalid orderId: ${orderId}`);
      return;
    }
    this.logger.log(`Emitting paymentSuccess for order ${orderId}`);
    this.server.to(orderId).emit('paymentSuccess', { orderId });
  }
}
