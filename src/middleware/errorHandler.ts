import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Error caught in middleware:', err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Failure',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
