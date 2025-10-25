#!/usr/bin/env bun

/**
 * Platform-agnostic dispatcher error
 * Used across all chat platforms for error handling
 */

/**
 * Base error class for all dispatcher errors
 */
export class DispatcherError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
