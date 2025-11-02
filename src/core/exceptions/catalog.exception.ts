import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para errores en el catálogo
 */
export class CatalogException extends BaseBusinessException {
  constructor(message: string, context?: Record<string, any>) {
    super(message, HttpStatus.BAD_REQUEST, 'CATALOG_ERROR', context);
  }
}

/**
 * Excepción para items de catálogo no disponibles
 */
export class CatalogItemUnavailableException extends BaseBusinessException {
  constructor(itemId: string, reason?: string, context?: Record<string, any>) {
    const reasonMsg = reason ? `: ${reason}` : '';
    super(
      `Item de catálogo '${itemId}' no disponible${reasonMsg}`,
      HttpStatus.CONFLICT,
      'CATALOG_ITEM_UNAVAILABLE',
      {
        itemId,
        reason,
        ...context,
      },
    );
  }
}

/**
 * Excepción para stock insuficiente
 */
export class InsufficientStockException extends BaseBusinessException {
  constructor(
    itemId: string,
    requested: number,
    available: number,
    context?: Record<string, any>,
  ) {
    super(
      `Stock insuficiente para item '${itemId}'. Solicitado: ${requested}, Disponible: ${available}`,
      HttpStatus.CONFLICT,
      'INSUFFICIENT_STOCK',
      {
        itemId,
        requested,
        available,
        ...context,
      },
    );
  }
}

/**
 * Excepción para categorías inválidas
 */
export class InvalidCategoryException extends BaseBusinessException {
  constructor(categoryId: string, context?: Record<string, any>) {
    super(
      `Categoría '${categoryId}' inválida o no existe`,
      HttpStatus.BAD_REQUEST,
      'INVALID_CATEGORY',
      {
        categoryId,
        ...context,
      },
    );
  }
}
