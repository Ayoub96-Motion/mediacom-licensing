import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError, errorBody } from "../lib/errors";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(errorBody("not_found", "Route not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    res.status(400).json(errorBody("validation_error", message));
    return;
  }

  console.error(err);
  res.status(500).json(errorBody("internal_error", "Something went wrong"));
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
