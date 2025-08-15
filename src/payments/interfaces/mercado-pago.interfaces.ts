export interface MercadoPagoItem {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  currency_id: string;
  unit_price: number;
  category_id?: string;
  picture_url?: string;
}

export interface MercadoPagoPayer {
  name?: string;
  surname?: string;
  first_name?: string; // MP preferred field for better approval rates
  last_name?: string; // MP preferred field for better approval rates
  email?: string;
  phone?: {
    area_code?: string;
    number?: string;
  };
  identification?: {
    type: string;
    number: string;
  };
  address?: {
    street_name?: string;
    street_number?: number;
    zip_code?: string;
  };
}

export interface MercadoPagoBackUrls {
  success?: string;
  failure?: string;
  pending?: string;
}

export interface CreatePreferenceOptions {
  items: MercadoPagoItem[];
  external_reference: string;
  payer?: MercadoPagoPayer;
  back_urls?: MercadoPagoBackUrls;
  notification_url?: string;
  auto_return?: 'approved' | 'all';
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
  };
  shipments?: {
    mode?: string;
    cost?: number;
  };
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  statement_descriptor?: string;
}

export interface PaymentSearchOptions {
  sort?:
    | 'date_approved'
    | 'date_created'
    | 'date_last_updated'
    | 'money_release_date';
  criteria?: 'asc' | 'desc';
  external_reference?: string;
  range?:
    | 'date_created'
    | 'date_last_updated'
    | 'date_approved'
    | 'money_release_date';
  begin_date?: string;
  end_date?: string;
  status?: string;
  operation_type?: string;
  site_id?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

export interface MerchantOrderSearchOptions {
  status?: string;
  preference_id?: string;
  application_id?: string;
  payer_id?: string;
  sponsor_id?: string;
  external_reference?: string;
  site_id?: string;
  marketplace?: string;
  date_created_from?: string;
  date_created_to?: string;
  last_udpated_from?: string;
  last_udpated_to?: string;
  items?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}
