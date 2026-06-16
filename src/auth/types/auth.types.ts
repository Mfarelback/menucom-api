export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  commerceId?: string;
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email?: string;
  role: string;
  commerceId?: string;
}
