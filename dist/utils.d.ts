import type { Logger } from "homebridge";
/**
 * Centralized error handling function
 */
export declare function handleError(log: Logger, message: string, error: unknown, level?: "error" | "warn" | "info"): void;
export declare class TimeoutError extends Error {
    constructor(message: string);
}
export declare function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T>;
//# sourceMappingURL=utils.d.ts.map