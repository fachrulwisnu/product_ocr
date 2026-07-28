import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  console.error('[API Error]', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const issues = err.issues || (err as any).errors || [];
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: issues.map((e: any) => ({
        field: e.path ? e.path.join('.') : '',
        message: e.message
      }))
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.details ? { details: err.details } : {})
  });
};
