import { Request } from 'express';
import { AuthenticatedUser } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
      commerceId?: string | null;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  tenantId?: string;
  commerceId?: string | null;
}
