export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = 'The requested resource was not found.') {
  return new AppError(404, 'NOT_FOUND', message);
}
