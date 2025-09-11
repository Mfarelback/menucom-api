export interface PaymentsMPResult {
  id: number;
  status: string;
  external_reference: string;
  preference_id: string;
  payments: Array<{
    id: number;
    transaction_amount: number;
    total_paid_amount: number;
    shipping_cost: number;
    currency_id: string;
    status: string;
    status_detail: string;
    operation_type: string;
    date_approved: string;
    date_created: string;
    last_modified: string;
    amount_refunded: number;
  }>;
  shipments: Array<any>;
  collector: {
    id: number;
    email: string;
    nickname: string;
  };
  marketplace: string;
  notification_url: string;
  date_created: string;
  last_updated: string;
  sponsor_id: number;
  shipping_cost: number;
  total_amount: number;
  site_id: string;
  paid_amount: number;
  refunded_amount: number;
  payer: {
    id: number;
    email: string;
    nickname: string;
  };
  items: Array<{
    id: string;
    category_id: string;
    currency_id: string;
    description: string;
    picture_url: string;
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  cancelled: boolean;
  additional_info: string;
  application_id: string;
  order_status: string;
}
