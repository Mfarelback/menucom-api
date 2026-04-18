export enum MembershipPlan {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum MembershipFeature {
  BASIC_MENU = 'basic_menu',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  CUSTOM_BRANDING = 'custom_branding',
  UNLIMITED_ITEMS = 'unlimited_items',
  MULTIPLE_LOCATIONS = 'multiple_locations',
  API_ACCESS = 'api_access',
  PRIORITY_SUPPORT = 'priority_support',
  WHITE_LABEL = 'white_label',
  CUSTOM_INTEGRATIONS = 'custom_integrations',
  DEDICATED_SUPPORT = 'dedicated_support',
}

export const PLAN_FEATURES = {
  [MembershipPlan.FREE]: [MembershipFeature.BASIC_MENU],
  [MembershipPlan.PREMIUM]: [
    MembershipFeature.BASIC_MENU,
    MembershipFeature.ADVANCED_ANALYTICS,
    MembershipFeature.CUSTOM_BRANDING,
    MembershipFeature.UNLIMITED_ITEMS,
    MembershipFeature.PRIORITY_SUPPORT,
  ],
  [MembershipPlan.ENTERPRISE]: [
    MembershipFeature.BASIC_MENU,
    MembershipFeature.ADVANCED_ANALYTICS,
    MembershipFeature.CUSTOM_BRANDING,
    MembershipFeature.UNLIMITED_ITEMS,
    MembershipFeature.MULTIPLE_LOCATIONS,
    MembershipFeature.API_ACCESS,
    MembershipFeature.WHITE_LABEL,
    MembershipFeature.CUSTOM_INTEGRATIONS,
    MembershipFeature.DEDICATED_SUPPORT,
  ],
};

export const PLAN_LIMITS = {
  [MembershipPlan.FREE]: {
    maxCatalogs: 1,
    maxCatalogItems: 10,
    maxLocations: 1,
    analyticsRetention: 7,
    maxUsers: 1,
    maxApiCalls: 100,
    storageLimit: 100,
  },
  [MembershipPlan.PREMIUM]: {
    maxCatalogs: 3,
    maxCatalogItems: 500,
    maxLocations: 3,
    analyticsRetention: 90,
    maxUsers: 3,
    maxApiCalls: 10000,
    storageLimit: 1000,
  },
  [MembershipPlan.ENTERPRISE]: {
    maxCatalogs: -1,
    maxCatalogItems: -1,
    maxLocations: -1,
    analyticsRetention: 365,
    maxUsers: -1,
    maxApiCalls: -1,
    storageLimit: -1,
  },
};
