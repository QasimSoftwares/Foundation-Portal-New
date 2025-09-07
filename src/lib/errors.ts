export class AppError extends Error {
  context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class SessionError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
    this.name = 'SessionError';
  }
}
