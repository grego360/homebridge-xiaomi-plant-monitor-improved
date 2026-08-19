/**
 * Centralized error handling function
 */
export function handleError(log, message, error, level = "error") {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logMessage = `${message}: ${errorMessage}`;
    log[level](logMessage);
}
export class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "TimeoutError";
    }
}
export function withTimeout(operation, timeoutMs, message) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
        operation.then((value) => {
            clearTimeout(timeout);
            resolve(value);
        }, (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}
//# sourceMappingURL=utils.js.map