import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRES_IN = "60m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

const getSecret = (
  key: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET",
  testFallback: string,
) => {
  const value = process.env[key];
  if (value && value.trim().length > 0) {
    return value;
  }

  if (process.env.NODE_ENV === "test") {
    return testFallback;
  }

  throw new Error(`${key} is required`);
};

export interface AuthTokenPayload {
  sub: number;
  orgId: number;
  email?: string | null;
}

export function signAccessToken(payload: AuthTokenPayload) {
  const accessSecret = getSecret(
    "JWT_ACCESS_SECRET",
    "test-access-secret-change-me",
  );
  return jwt.sign(payload, accessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: AuthTokenPayload) {
  const refreshSecret = getSecret(
    "JWT_REFRESH_SECRET",
    "test-refresh-secret-change-me",
  );
  return jwt.sign(payload, refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const accessSecret = getSecret(
    "JWT_ACCESS_SECRET",
    "test-access-secret-change-me",
  );
  return jwt.verify(token, accessSecret) as any;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  const refreshSecret = getSecret(
    "JWT_REFRESH_SECRET",
    "test-refresh-secret-change-me",
  );
  return jwt.verify(token, refreshSecret) as any;
}
