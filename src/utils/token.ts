import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me";

export interface AuthTokenPayload {
  sub: number;
  orgId: number;
  email?: string | null;
}

export function signAccessToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as any;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as any;
}
