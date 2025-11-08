import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from './base.exception';

/**
 * Excepción para catálogo no encontrado
 */
export class CatalogNotFoundException extends BaseBusinessException {
  constructor(identifier: string, context?: Record<string, any>) {
    super(
      `Catálogo '${identifier}' no encontrado`,
      HttpStatus.NOT_FOUND,
      'CATALOG_NOT_FOUND',
      {
        catalogId: identifier,
        ...context,
      },
    );
  }
}

/**
 * Excepción para item de catálogo no encontrado
 */
export class CatalogItemNotFoundException extends BaseBusinessException {
  constructor(itemId: string, context?: Record<string, any>) {
    super(
      `Item de catálogo '${itemId}' no encontrado`,
      HttpStatus.NOT_FOUND,
      'CATALOG_ITEM_NOT_FOUND',
      {
        itemId,
        ...context,
      },
    );
  }
}

/**
 * Excepción para acceso no autorizado al catálogo
 */
export class CatalogUnauthorizedException extends BaseBusinessException {
  constructor(
    catalogId: string,
    userId: string,
    context?: Record<string, any>,
  ) {
    super(
      `Usuario '${userId}' no tiene permisos para acceder al catálogo '${catalogId}'`,
      HttpStatus.FORBIDDEN,
      'CATALOG_UNAUTHORIZED',
      {
        catalogId,
        userId,
        ...context,
      },
    );
  }
}

/**
 * Excepción para datos de catálogo inválidos
 */
export class InvalidCatalogDataException extends BaseBusinessException {
  constructor(reason: string, context?: Record<string, any>) {
    super(
      `Datos de catálogo inválidos: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_CATALOG_DATA',
      context,
    );
  }
}

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
