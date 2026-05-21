import type { Response } from "express";

type ApiSuccessPayload<T> = {
  status?: number;
  message: string;
  data: T;
  meta?: Record<string, unknown> | null;
};

type ApiErrorPayload = {
  status?: number;
  message: string;
  error?: unknown;
  meta?: Record<string, unknown> | null;
};

export const sendSuccess = <T>(res: Response, payload: ApiSuccessPayload<T>) => {
  return res.status(payload.status ?? 200).json({
    message: payload.message,
    data: payload.data,
    meta: payload.meta ?? null,
    error: null,
  });
};

export const sendError = (res: Response, payload: ApiErrorPayload) => {
  return res.status(payload.status ?? 500).json({
    message: payload.message,
    data: null,
    meta: payload.meta ?? null,
    error: payload.error ?? null,
  });
};
