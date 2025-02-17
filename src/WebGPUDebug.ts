export class WebGPUDebug {
    static async getShaderCompilationInfo(module: GPUShaderModule, code: string): Promise<string> {
        const info = await module.getCompilationInfo();
        const lines = code.split('\n');
        const msgs = [...info.messages].sort((a, b) => b.lineNum - a.lineNum);

        // Insert error messages between lines
        for (const msg of msgs) {
            lines.splice(msg.lineNum, 0,
                `${''.padEnd(msg.linePos - 1)}${''.padEnd(msg.length, '^')}`,
                `[${msg.type}] ${msg.message}`,
            );
        }

        return lines.join('\n');
    }
}