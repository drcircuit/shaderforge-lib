import { Logger } from './Logger';

export class TimingHelper {
    private canTimestamp: boolean;
    private device: GPUDevice;
    private querySet: GPUQuerySet | null = null;
    private resolveBuffer: GPUBuffer | null = null;
    private resultBuffers: GPUBuffer[] = [];  // Pool of result buffers
    private currentBuffer: GPUBuffer | null = null;
    private lastFrameGPUTime = 0;
    private bufferIndex = 0;
    private readonly BUFFER_COUNT = 3;  // Triple buffering
    private initialized = false;

    constructor(device: GPUDevice) {
        this.device = device;
        this.canTimestamp = device.features.has('timestamp-query');
        this.initializeTimingResources();
    }

    private initializeTimingResources(): void {
        if (!this.canTimestamp || this.initialized) return;

        try {
            // Create query set
            this.querySet = this.device.createQuerySet({
                type: 'timestamp',
                count: 2,
                label: 'Performance Timing Query Set'
            });
            
            // Create resolve buffer
            this.resolveBuffer = this.device.createBuffer({
                size: 16,
                usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
                label: 'Timing Resolve Buffer'
            });

            // Create buffer pool
            this.resultBuffers = Array(this.BUFFER_COUNT).fill(null).map((_, i) => 
                this.device.createBuffer({
                    size: 16,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                    label: `Timing Result Buffer ${i}`
                })
            );

            this.initialized = true;
            Logger.log('GPU Timing initialized successfully', {
                bufferCount: this.resultBuffers.length,
                canTimestamp: this.canTimestamp
            });
        } catch (error) {
            Logger.error('Failed to initialize GPU timing:', error);
            this.cleanup();
            this.canTimestamp = false;
        }
    }

    beginRenderPass(encoder: GPUCommandEncoder, descriptor: GPURenderPassDescriptor): GPURenderPassEncoder {
        if (!this.canTimestamp || !this.querySet) {
            return encoder.beginRenderPass(descriptor);
        }

        try {
            return encoder.beginRenderPass({
                ...descriptor,
                timestampWrites: {
                    querySet: this.querySet,
                    beginningOfPassWriteIndex: 0,
                    endOfPassWriteIndex: 1,
                }
            });
        } catch (error) {
            Logger.error('Failed to begin render pass with timing:', error);
            return encoder.beginRenderPass(descriptor);
        }
    }

    resolveTimestamp(encoder: GPUCommandEncoder): void {
        if (!this.canTimestamp || !this.querySet || !this.resolveBuffer || !this.initialized) {
            return;
        }

        try {
            const nextBuffer = this.resultBuffers[this.bufferIndex];
            if (!nextBuffer) {
                throw new Error('Buffer not available in pool');
            }

            this.currentBuffer = nextBuffer;
            this.bufferIndex = (this.bufferIndex + 1) % this.BUFFER_COUNT;

            encoder.resolveQuerySet(this.querySet, 0, 2, this.resolveBuffer, 0);
            encoder.copyBufferToBuffer(
                this.resolveBuffer,
                0,
                this.currentBuffer,
                0,
                16
            );
        } catch (error) {
            Logger.error('Failed to resolve timestamp:', {
                error,
                bufferIndex: this.bufferIndex,
                buffersAvailable: this.resultBuffers.length
            });
            this.currentBuffer = null;
        }
    }

    async getResult(): Promise<number> {
        if (!this.canTimestamp || !this.currentBuffer) {
            return this.lastFrameGPUTime;
        }

        try {
            await this.currentBuffer.mapAsync(GPUMapMode.READ);
            const data = new BigInt64Array(this.currentBuffer.getMappedRange());
            // Timestamps are in nanoseconds (1e-9 seconds)
            // Convert to milliseconds (1e-3 seconds)
            const duration = Number(data[1] - data[0]) / 1_000_000; 
            this.currentBuffer.unmap();

            if (isFinite(duration) && duration >= 0) {
                this.lastFrameGPUTime = duration;
            }
            return this.lastFrameGPUTime;

        } catch (error) {
            Logger.error('Failed to get GPU timing result:', error);
            return this.lastFrameGPUTime;
        }
    }

    private cleanup(): void {
        this.querySet?.destroy();
        this.resolveBuffer?.destroy();
        
        this.resultBuffers.forEach(buffer => buffer?.destroy());
        this.resultBuffers = [];
        
        this.querySet = null;
        this.resolveBuffer = null;
        this.currentBuffer = null;
        this.initialized = false;
    }

    destroy(): void {
        this.cleanup();
        this.lastFrameGPUTime = 0;
        this.bufferIndex = 0;
    }
}