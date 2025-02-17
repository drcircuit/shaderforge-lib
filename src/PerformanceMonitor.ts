export class PerformanceMonitor {
    private container: HTMLElement;
    private statsElement!: HTMLElement;
    private fpsHistory: number[] = [];
    private jsTimeHistory: number[] = [];
    private gpuTimeHistory: number[] = [];
    private historySize = 60; // 1 second at 60fps
    private visible = false;

    constructor(container: HTMLElement) {
        this.container = container;
        this.setupUI();
        this.setupKeyboardControls();
    }

    private setupUI(): void {
        // Add Oxanium font
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&display=swap';
        document.head.appendChild(fontLink);

        const style = document.createElement('style');
        style.textContent = `
            .shaderforge-stats {
                position: absolute;
                top: 8px;
                right: 8px;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.75);
                color: #00ffaf;
                font-family: 'Oxanium', monospace;
                font-size: 14px;
                line-height: 1.4;
                letter-spacing: 0.5px;
                border-radius: 4px;
                border: 1px solid rgba(0, 255, 136, 0.2);
                backdrop-filter: blur(8px);
                display: none;
                z-index: 1000;
                pointer-events: none;
                transform: translateZ(0);
            }
            .shaderforge-stats-row {
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
            }
            .shaderforge-stats-label {
                color: rgba(0, 255, 136, 0.6);
                font-weight: 300;
            }
            .shaderforge-stats-value {
                font-weight: 500;
                min-width: 60px;
                text-align: right;
            }
        `;
        document.head.appendChild(style);

        this.statsElement = document.createElement('div');
        this.statsElement.className = 'shaderforge-stats';
        this.container.appendChild(this.statsElement);
    }

    private setupKeyboardControls(): void {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'f') {
                this.visible = !this.visible;
                this.statsElement.style.display = this.visible ? 'block' : 'none';
            }
        });
    }

    update(fps: number, jsTime: number, gpuTime: number): void {
        if (!this.visible) return;

        // Update history with validated values
        if (isFinite(fps) && fps > 0) {
            this.fpsHistory.push(Math.min(fps, 1000));
        }
        if (isFinite(jsTime)) {
            this.jsTimeHistory.push(jsTime);
        }
        if (isFinite(gpuTime)) {
            this.gpuTimeHistory.push(gpuTime);
        }

        // Keep history size limited
        if (this.fpsHistory.length > this.historySize) {
            this.fpsHistory.shift();
            this.jsTimeHistory.shift();
            this.gpuTimeHistory.shift();
        }

        // Calculate averages
        const avgFps = this.average(this.fpsHistory);
        const avgJs = this.average(this.jsTimeHistory);
        const avgGpu = this.average(this.gpuTimeHistory);

        // Update stats with styled layout
        this.statsElement.innerHTML = `
            <div class="shaderforge-stats-row">
                <span class="shaderforge-stats-label">FPS</span>
                <span class="shaderforge-stats-value">${avgFps.toFixed(2)}</span>
            </div>
            <div class="shaderforge-stats-row">
                <span class="shaderforge-stats-label">JS</span>
                <span class="shaderforge-stats-value">${avgJs.toFixed(4)}ms</span>
            </div>
            <div class="shaderforge-stats-row">
                <span class="shaderforge-stats-label">GPU</span>
                <span class="shaderforge-stats-value">${avgGpu.toFixed(4)}ms</span>
            </div>
        `;
    }

    private average(arr: number[]): number {
        if (arr.length === 0) return 0;
        const validNumbers = arr.filter(n => isFinite(n) && n >= 0);
        if (validNumbers.length === 0) return 0;
        return validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length;
    }
}