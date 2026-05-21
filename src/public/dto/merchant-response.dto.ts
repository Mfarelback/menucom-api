import { CatalogType } from '../../catalog/enums/catalog-type.enum';

class CatalogItemPublic {
  id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  photoURL?: string;
  category?: string;
  isAvailable: boolean;
}

class CatalogPublic {
  id: string;
  name?: string;
  slug?: string;
  type: CatalogType;
  description?: string;
  coverImageUrl?: string;
  tags?: string[];
  itemCount: number;
  viewCount: number;
  items?: CatalogItemPublic[];
}

class MerchantStats {
  totalCatalogs: number;
  totalItems: number;
  totalViews: number;
  memberSince: Date;
}

class MerchantContactInfo {
  email?: string;
  phone?: string;
}

class MerchantMembership {
  plan: string;
  features?: string[];
}

export class MerchantListItem {
  id: string;
  slug?: string;
  businessName?: string;
  description?: string;
  photoURL: string;
  coverImageUrl?: string;
  catalogTypes: CatalogType[];
  catalogCount: number;
  totalItems: number;
  tags: string[];
  viewCount: number;
  createdAt: Date;
}

export class MerchantDetail {
  id: string;
  slug?: string;
  businessName?: string;
  description?: string;
  photoURL: string;
  coverImageUrl?: string;
  contactInfo: MerchantContactInfo;
  catalogTypes: CatalogType[];
  catalogs: CatalogPublic[];
  stats: MerchantStats;
  membership: MerchantMembership;
}
