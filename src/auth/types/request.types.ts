import { Request } from 'express';

/**
 * Extensión del tipo Request de Express para incluir
 * la propiedad user que es agregada por Passport
 */
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: any;
}
