import type { Logger } from "homebridge";

/**
 * Centralized error handling function
 */
export function handleError(
  log: Logger,
  message: string,
  error: unknown,
  level: "error" | "warn" | "info" = "error",
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const logMessage = `${message}: ${errorMessage}`;
  log[level](logMessage);
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
