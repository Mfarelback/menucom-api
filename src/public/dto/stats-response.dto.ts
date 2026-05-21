export class TopCategory {
  type: string;
  merchants: number;
}

export class StatsResponse {
  totalMerchants: number;
  totalCatalogs: number;
  totalItems: number;
  totalOrders: number;
  merchantGrowth: number;
  topCategories: TopCategory[];
}
