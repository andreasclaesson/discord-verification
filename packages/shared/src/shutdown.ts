type CleanupFn = () => void | Promise<void>;

export function registerGracefulShutdown(label: string, cleanup: CleanupFn, timeoutMs = 10_000): void {
    let shuttingDown = false;

    async function handle(signal: string): Promise<void> {
        if (shuttingDown) return; // second signal while already shutting down, ignore, let the first one finish
        shuttingDown = true;
        console.log(`[${label}] received ${signal}, shutting down...`);

        const forceExit = setTimeout(() => {
            console.error(`[${label}] shutdown did not complete within ${timeoutMs}ms, forcing exit`);
            process.exit(1);
        }, timeoutMs);
        forceExit.unref();

        try {
            await cleanup();
            clearTimeout(forceExit);
            console.log(`[${label}] shutdown complete`);
            process.exit(0);
        } catch (err) {
            console.error(`[${label}] error during shutdown:`, err);
            process.exit(1);
        }
    }

    process.on('SIGTERM', () => void handle('SIGTERM'));
    process.on('SIGINT', () => void handle('SIGINT'));
}