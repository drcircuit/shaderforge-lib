export class Logger {
    private static DEBUG = true;
    private static PREFIX = '[ShaderForge]';

    static log(message: string, data?: any): void {
        if (!this.DEBUG) return;

        if (data) {
            console.log(`${this.PREFIX} ${message}`, {
                timestamp: new Date().toISOString(),
                ...data
            });
        } else {
            console.log(`${this.PREFIX} ${message}`);
        }
    }

    static error(message: string, error?: any): void {
        console.error(`${this.PREFIX} ${message}`, error);
    }

    static warn(message: string, data?: any): void {
        console.warn(`${this.PREFIX} ${message}`, data);
    }

    static setDebug(enabled: boolean): void {
        this.DEBUG = enabled;
    }
}