declare module 'passport-custom' {
  import { Strategy as PassportStrategy } from 'passport';

  interface VerifyFunction {
    (req: any, done: (error: any, user?: any, info?: any) => void): void;
  }

  interface StrategyOptions {
    passReqToCallback?: boolean;
  }

  class Strategy extends PassportStrategy {
    constructor(verify: VerifyFunction);
    constructor(options: StrategyOptions, verify: VerifyFunction);
  }

  export { Strategy };
}
