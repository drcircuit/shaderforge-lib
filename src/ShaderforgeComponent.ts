// src/ShaderforgeComponent.ts

import { WebGPUShaderEffect } from "./WebGPUShaderEffect";
import { ShaderEditor } from './ShaderEditor';
import { Logger } from './Logger';

// Add options interface
export interface ShaderforgeOptions {
  enableEditor?: boolean;
}

export class ShaderforgeComponent {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private effect: WebGPUShaderEffect;
  private vertexShaderSource: string = '';
  private fragmentShaderSource: string = '';
  private shaderEditor: ShaderEditor | null = null;
  private options: ShaderforgeOptions;
  private isInitialized: boolean = false;
  private pendingShaders: {vertex: string, fragment: string, isUrl: boolean} | null = null;

  constructor(container: HTMLElement, options: ShaderforgeOptions = {}) {
    this.container = container;
    this.options = {
      enableEditor: true,
      ...options
    };

    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);

    // Set the initial size via code.
    this.resizeCanvas();

    // Update canvas size when the window resizes.
    window.addEventListener("resize", () => this.resizeCanvas());

    // Listen for CTRL+ENTER to reload/recompile the effect.
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        this.reloadEffect();
      }
    });

    // Instantiate the shader effect.
    this.effect = new WebGPUShaderEffect(this.canvas);

    // Initialize editor only if enabled
    if (this.options.enableEditor) {
      this.shaderEditor = new ShaderEditor(container, async (code) => {
        this.fragmentShaderSource = code;
        if (this.isInitialized) {
          await this.recompileShaders();
        }
      });
    }
  }

  // Update method to handle both URLs and source code
  async setShaders(vertex: string, fragment: string, isUrl: boolean = false) {
    this.pendingShaders = { vertex, fragment, isUrl };
    
    if (this.isInitialized) {
      await this.loadAndCompileShaders();
    }
  }

  private async loadAndCompileShaders(): Promise<void> {
    if (!this.pendingShaders) return;
    
    const { vertex, fragment, isUrl } = this.pendingShaders;
    
    try {
      if (isUrl) {
        const [vertexResponse, fragmentResponse] = await Promise.all([
          fetch(vertex),
          fetch(fragment)
        ]);

        if (!vertexResponse.ok || !fragmentResponse.ok) {
          throw new Error('Failed to load shaders from URLs');
        }

        this.vertexShaderSource = await vertexResponse.text();
        this.fragmentShaderSource = await fragmentResponse.text();
      } else {
        this.vertexShaderSource = vertex;
        this.fragmentShaderSource = fragment;
      }

      if (this.shaderEditor) {
        this.shaderEditor.setCode(this.fragmentShaderSource);
      }
      
      await this.recompileShaders();
    } catch (error) {
      Logger.error('Failed to load/compile shaders:', error);
      throw error;
    }
  }

  /**
   * Set shader sources from URLs.
   * @param vertexUrl URL to the vertex shader source
   * @param fragmentUrl URL to the fragment shader source
   */
  async setShaderURLs(vertexUrl: string, fragmentUrl: string): Promise<void> {
    await this.setShaders(vertexUrl, fragmentUrl, true);
  }

  // Initialize WebGPU
  async initialize() {
    await this.effect.initialize();
    this.isInitialized = true;
    
    if (this.pendingShaders) {
      await this.loadAndCompileShaders();
    }
  }

  private async recompileShaders(): Promise<void> {
    try {
      await this.effect.createRenderPipeline(
        this.vertexShaderSource, 
        this.fragmentShaderSource
      );
      this.effect.startRendering();
    } catch (error) {
      Logger.error('Failed to recompile shaders:', error);
      throw error;
    }
  }

  // Resize the canvas to fill its container while maintaining a 16:9 aspect ratio.
  private resizeCanvas() {
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    
    // Calculate size maintaining 16:9 aspect ratio
    let width = Math.min(containerWidth, 1280);
    let height = width * (9/16);
    
    // If height is too big, scale down maintaining aspect ratio
    if (height > containerHeight) {
        height = Math.min(containerHeight, 720);
        width = height * (16/9);
    }
    
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Set actual canvas resolution
    this.canvas.width = width;
    this.canvas.height = height;
  }

  // Update the reload method
  async reloadEffect() {
    Logger.log("Reloading shader effect...");
    this.effect.stopRendering();
    await this.recompileShaders();
    this.effect.startRendering();
  }
}
