// add reference to @types/webgpu
/// <reference types="@webgpu/types" />
// src/ShaderforgeComponent.ts

import { ExtraUniformManager } from "./ExtraUniformManager";
import { globalUniformsWGSL } from "./GlobalUniformsWGSL";
import { WebGPUDebug } from './WebGPUDebug';
import { TimingHelper } from './TimingHelper';
import { PerformanceMonitor } from './PerformanceMonitor';
import { Logger } from './Logger';

// Update the logging helper at the top of the file
const DEBUG = true;

// Update the interface
export interface GlobalUniformData {
    time: number;
    deltaTime: number;
    viewportWidth: number;
    viewportHeight: number;
}

// Update buffer size constants to ensure proper alignment
const GLOBAL_UNIFORM_ALIGNMENT = 16;
const GLOBAL_UNIFORM_SIZE = 
    (16 + // time, deltaTime (8 bytes aligned to 16)
    16);  // viewport (vec2<f32>, 16-byte aligned)

// Make sure size is aligned to 16 bytes
const alignedSize = Math.ceil(GLOBAL_UNIFORM_SIZE / GLOBAL_UNIFORM_ALIGNMENT) * GLOBAL_UNIFORM_ALIGNMENT;
const UNIFORM_FLOAT_COUNT = alignedSize / 4;

export class WebGPUShaderEffect {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private format!: GPUTextureFormat;

  // Pipeline and uniform resources
  private renderPipeline: GPURenderPipeline | null = null;
  private globalUniformBuffer: GPUBuffer | null = null;
  private bindGroups: GPUBindGroup[] = [];

  // Global uniform state (updated every frame)
  public globalUniformData: GlobalUniformData = {
    time: 0,
    deltaTime: 0,
    viewportWidth: 0,
    viewportHeight: 0
  };

  // Extra uniforms managed by the user.
  public extraUniforms = new ExtraUniformManager();

  // Frame timing
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private animationFrameId: number = 0;

  // Initialize timingHelper with a default value
  private timingHelper!: TimingHelper;
  private performanceMonitor: PerformanceMonitor;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.performanceMonitor = new PerformanceMonitor(canvas.parentElement || document.body);
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser.");
    }
    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error("Failed to acquire GPU adapter.");
    }
    
    // Request device with timestamp-query feature if available
    const canTimestamp = this.adapter.features.has('timestamp-query');
    this.device = await this.adapter.requestDevice({
        requiredFeatures: [
            ...(canTimestamp ? ['timestamp-query' as GPUFeatureName] : []),
        ],
    });
    
    if (!this.device) {
        throw new Error("Failed to create GPU device.");
    }

    // Initialize context and format
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    if (!this.context) {
        throw new Error("Failed to get WebGPU context from canvas.");
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "premultiplied"
    });

    // Initialize timing helper after device is created
    this.timingHelper = new TimingHelper(this.device);
    this.setupErrorHandling();
  }

  // Utility: load shader code from a URL using fetch.
  async loadShaderFromURL(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load shader from ${url}`);
    }
    return await response.text();
  }

  // Create (or recreate) the render pipeline along with uniform buffers.
  async createRenderPipeline(vertexShaderCode: string, fragmentShaderCode: string): Promise<void> {
    try {
        if (!this.device) {
            throw new Error("Device not initialized");
        }
        this.destroyPipeline();

        // Create shader modules without error scopes first
        Logger.log("Creating shader modules...");
        const vertexModule = this.device.createShaderModule({ 
            code: vertexShaderCode,
            label: "Vertex Shader"
        });
        const fragmentModule = this.device.createShaderModule({ 
            code: fragmentShaderCode,
            label: "Fragment Shader"
        });

        // Create uniform buffer
        Logger.log("Creating global uniform buffer...");
        this.globalUniformBuffer = this.device.createBuffer({
            size: GLOBAL_UNIFORM_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: "Global Uniforms Buffer"
        });

        // Initialize buffer with zeros
        const initialData = new Float32Array(UNIFORM_FLOAT_COUNT);
        this.device.queue.writeBuffer(this.globalUniformBuffer, 0, initialData);
        Logger.log("Initialized uniform buffer", { size: initialData.byteLength });

        // Create pipeline with error scope
        this.device.pushErrorScope('validation');

        // Create bind group layout
        const globalsBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                    minBindingSize: GLOBAL_UNIFORM_SIZE,
                    hasDynamicOffset: false
                }
            }],
            label: "Globals Bind Group Layout"
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [globalsBindGroupLayout],
            label: "Pipeline Layout"
        });

        // Create bind group
        const globalsBindGroup = this.device.createBindGroup({
            layout: globalsBindGroupLayout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.globalUniformBuffer,
                    offset: 0,
                    size: GLOBAL_UNIFORM_SIZE
                }
            }],
            label: "Globals Bind Group"
        });

        Logger.log("Created bind group", { 
            bufferSize: this.globalUniformBuffer.size,
            minBindingSize: GLOBAL_UNIFORM_SIZE 
        });

        this.bindGroups = [globalsBindGroup];

        // Create pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexModule,
                entryPoint: "main"
            },
            fragment: {
                module: fragmentModule,
                entryPoint: "main",
                targets: [{ format: this.format }]
            },
            primitive: { 
                topology: "triangle-list",
                cullMode: "none"
            },
            label: "Main Render Pipeline"
        });

        // Check for any validation errors
        const error = await this.device.popErrorScope();
        if (error) {
            throw error;
        }

        Logger.log("Pipeline creation successful");

    } catch (error) {
        Logger.error("Pipeline creation failed", { 
            error,
            message: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

  /**
   * Update the global uniform buffer with data from the provided GlobalUniformData.
   * Layout (Float32Array of length 8):
   *   0: time  
   *   1: deltaTime  
   *   2-3: padding  
   *   4: viewportWidth  
   *   5: viewportHeight  
   *   6-7: padding  
   */
  updateGlobalUniformBuffer(data: GlobalUniformData): void {
    if (!this.device || !this.globalUniformBuffer) return;
    const uniformArray = new Float32Array(UNIFORM_FLOAT_COUNT);
    
    // Basic uniforms - first 16 bytes (4 floats)
    uniformArray[0] = data.time;
    uniformArray[1] = data.deltaTime;
    // padding[2,3] implicit in Float32Array

    // Viewport size - next 16 bytes (aligned vec2)
    uniformArray[4] = data.viewportWidth;
    uniformArray[5] = data.viewportHeight;
    // padding[6,7] implicit in Float32Array

    this.device.queue.writeBuffer(this.globalUniformBuffer, 0, uniformArray);
  }

  // Render loop: update uniforms and draw the quad.
  render = (timestamp: number) => {
    if (!this.device || !this.context || !this.renderPipeline) return;

    try {
        const jsStart = performance.now();
        const deltaTime = this.updateTiming(timestamp);
        const fps = deltaTime > 0 ? 1 / deltaTime : 0; // FPS from seconds

        this.updateUniforms();
        const encoder = this.device.createCommandEncoder();
        
        // Use optional chaining for timingHelper methods
        const pass = this.timingHelper?.beginRenderPass(encoder, {
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        }) ?? encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        pass.setPipeline(this.renderPipeline);
        pass.setBindGroup(0, this.bindGroups[0]);
        pass.draw(6, 1, 0, 0);
        pass.end();

        // Resolve timestamp and submit commands
        this.timingHelper?.resolveTimestamp(encoder);
        const commandBuffer = encoder.finish();
        this.device.queue.submit([commandBuffer]);

        const jsTime = performance.now() - jsStart;

        // Use deltaTime for fallback GPU timing
        Promise.resolve()
            .then(async () => {
                const gpuTime = await this.timingHelper?.getResult() ?? deltaTime * 1000;
                this.performanceMonitor.update(fps, jsTime, gpuTime);
            })
            .catch(error => {
                Logger.error('Error getting GPU timing:', {
                    error,
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                });
                // Fallback to using deltaTime for GPU time
                this.performanceMonitor.update(fps, jsTime, deltaTime * 1000);
            })
            .finally(() => {
                this.animationFrameId = requestAnimationFrame(this.render);
            });

    } catch (error) {
        console.error('Render error:', error);
        this.stopRendering();
    }
}

  // Start the render loop.
  startRendering(): void {
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.animationFrameId = requestAnimationFrame(this.render);
  }

  // Stop the render loop.
  stopRendering(): void {
    cancelAnimationFrame(this.animationFrameId);
  }

  // Reload shaders from URLs and restart rendering.
  async reloadShaders(vertexUrl: string, fragmentUrl: string): Promise<void> {
    this.stopRendering();
    const vertexCode = await this.loadShaderFromURL(vertexUrl);
    const fragmentCode = await this.loadShaderFromURL(fragmentUrl);
    await this.createRenderPipeline(vertexCode, fragmentCode);
    this.startRendering();
  }

  // Clean up GPU resources.
  destroyPipeline(): void {
    this.stopRendering();
    
    if (this.globalUniformBuffer) {
        Logger.log("Destroying uniform buffer...");
        this.globalUniformBuffer.destroy();
        this.globalUniformBuffer = null;
    }
    
    if (this.timingHelper) {
        this.timingHelper.destroy();
    }
    
    Logger.log("Clearing pipeline and bind groups...");
    this.renderPipeline = null;
    this.bindGroups = [];
  }

  // Add error handling setup
  private setupErrorHandling(): void {
    if (!this.device) return;
    
    this.device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
        Logger.log('Uncaptured WebGPU error:', event.error);
        // Prevent error from also going to console
        event.preventDefault();
    });
  }

  // Add this method to help debug buffer issues
  private validateBindGroup(bindGroup: GPUBindGroup, layout: GPUBindGroupLayout): void {
    if (!this.device) return;
    
    Logger.log("Validating bind group...", {
        hasBuffer: !!this.globalUniformBuffer,
        bufferSize: this.globalUniformBuffer?.size,
        uniformSize: GLOBAL_UNIFORM_SIZE,
        bindGroup: bindGroup,
        layout: layout
    });
  }

  private updateTiming(timestamp: number): number {
    const now = timestamp * 0.001; // Convert to seconds
    if (this.startTime === 0) {
        this.startTime = now;
        this.lastFrameTime = now;
        return 0;
    }

    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    return deltaTime; // Return in seconds
}

private updateUniforms(): void {
    // Update viewport dimensions
    this.globalUniformData.viewportWidth = this.canvas.width;
    this.globalUniformData.viewportHeight = this.canvas.height;

    // Update timing
    const elapsedTime = (performance.now() - this.startTime) / 1000; // Convert to seconds
    this.globalUniformData.time = elapsedTime;
    
    // Update uniforms in GPU buffer
    this.updateGlobalUniformBuffer(this.globalUniformData);
}
}
