import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

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
 */
@WebSocketGateway({ cors: true })
export class PaymentsGateway {
  @WebSocketServer()
  server: Server;

  /**
   * El frontend puede suscribirse a eventos de pago por orderId
   * @param orderId ID de la orden a escuchar
   */
  @SubscribeMessage('subscribeToOrder')
  handleSubscribe(@MessageBody() orderId: string) {
    // El cliente se une a una "room" con el orderId
    // para recibir eventos solo de esa orden
    this.server.socketsJoin(orderId);
    return { message: `Subscribed to order ${orderId}` };
  }

  /**
   * Emitir evento de pago exitoso a los clientes suscritos a la orden
   * @param orderId ID de la orden pagada
   */
  emitPaymentSuccess(orderId: string) {
    this.server.to(orderId).emit('paymentSuccess', { orderId });
  }
}
