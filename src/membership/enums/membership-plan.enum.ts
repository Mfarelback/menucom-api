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
    maxMenuItems: 10,
    maxLocations: 1,
    analyticsRetention: 7, // days
  },
  [MembershipPlan.PREMIUM]: {
    maxMenuItems: 500,
    maxLocations: 3,
    analyticsRetention: 90, // days
  },
  [MembershipPlan.ENTERPRISE]: {
    maxMenuItems: -1, // unlimited
    maxLocations: -1, // unlimited
    analyticsRetention: 365, // days
  },
};
