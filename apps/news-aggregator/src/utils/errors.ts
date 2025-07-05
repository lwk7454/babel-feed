export class AggregatorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AggregatorError';
  }
}

export class SourceError extends AggregatorError {
  constructor(
    message: string,
    public readonly sourceId: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'SOURCE_ERROR', 500, { sourceId, ...details });
    this.name = 'SourceError';
  }
}

export class ProcessingError extends AggregatorError {
  constructor(
    message: string,
    public readonly articleId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'PROCESSING_ERROR', 500, { articleId, ...details });
    this.name = 'ProcessingError';
  }
}

export class TranslationError extends AggregatorError {
  constructor(
    message: string,
    public readonly sourceLanguage: string,
    public readonly targetLanguage: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'TRANSLATION_ERROR', 500, { sourceLanguage, targetLanguage, ...details });
    this.name = 'TranslationError';
  }
}

export class ValidationError extends AggregatorError {
  constructor(
    message: string,
    public readonly field: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { field, ...details });
    this.name = 'ValidationError';
  }
}

export function handleError(error: unknown): AggregatorError {
  if (error instanceof AggregatorError) {
    return error;
  }

  if (error instanceof Error) {
    return new AggregatorError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name }
    );
  }

  return new AggregatorError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    { originalError: String(error) }
  );
}