/**
 * Centralized error handling function
 */
export function handleError(log, message, error, level = 'error') {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logMessage = `[${timestamp}] ${message}: ${errorMessage}`;
    if (level === 'error') {
        log.error(logMessage);
    }
    else if (level === 'warn') {
        log.warn(logMessage);
    }
    else {
        log.info(logMessage);
    }
}
//# sourceMappingURL=utils.js.map