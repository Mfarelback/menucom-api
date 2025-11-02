/**
 * Tipos de catálogos soportados por el sistema
 * Cada tipo representa un dominio de negocio diferente
 */
export enum CatalogType {
  MENU = 'menu', // Menús de restaurantes
  WARDROBE = 'wardrobe', // Guardarropas/tiendas de ropa
  PRODUCT_LIST = 'product_list', // Lista de productos genérica
  SERVICE_LIST = 'service_list', // Lista de servicios
  MARKETPLACE = 'marketplace', // Marketplace/catálogo de vendedores
}

/**
 * Estados posibles de un catálogo
 */
export enum CatalogStatus {
  DRAFT = 'draft', // Borrador, no visible públicamente
  ACTIVE = 'active', // Activo y visible
  INACTIVE = 'inactive', // Inactivo temporalmente
  ARCHIVED = 'archived', // Archivado, no editable
}

/**
 * Estados posibles de un item del catálogo
 */
export enum CatalogItemStatus {
  AVAILABLE = 'available', // Disponible para compra/pedido
  OUT_OF_STOCK = 'out_of_stock', // Sin stock
  DISCONTINUED = 'discontinued', // Descontinuado
  COMING_SOON = 'coming_soon', // Próximamente
}
