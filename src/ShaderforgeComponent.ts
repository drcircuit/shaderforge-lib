// src/ShaderforgeComponent.ts

import { WebGPUShaderEffect } from "./WebGPUShaderEffect";
import { ShaderEditor } from './ShaderEditor';
import { Logger } from './Logger';

export class ShaderforgeComponent {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private effect: WebGPUShaderEffect;
  private currentVertexUrl: string = "";
  private currentFragmentUrl: string = "";
  private shaderEditor: ShaderEditor;
  private fragmentShaderCode: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
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

    // Optional: Add mouse and key event listeners to update uniforms.
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Normalize coordinates to [0, 1]
    });

    window.addEventListener("keydown", (e) => {
    });

    this.shaderEditor = new ShaderEditor(container, async (code) => {
      this.fragmentShaderCode = code;
      await this.recompileShaders();
    });
  }

  // Set shader URLs so they can be reused on reload.
  setShaderURLs(vertexUrl: string, fragmentUrl: string) {
    this.currentVertexUrl = vertexUrl;
    this.currentFragmentUrl = fragmentUrl;
  }

  // Initialize WebGPU and load the shaders.
  async initialize() {
    await this.effect.initialize();
    await this.loadShaders();
    await this.recompileShaders();
  }

  async loadShaders(): Promise<void> {
    // Load fragment shader
    const response = await fetch(this.currentFragmentUrl);
    if (!response.ok) {
      throw new Error(`Failed to load fragment shader: ${this.currentFragmentUrl}`);
    }
    this.fragmentShaderCode = await response.text();
    this.shaderEditor.setCode(this.fragmentShaderCode);
  }

  private async recompileShaders(): Promise<void> {
    try {
      const vertexCode = await this.effect.loadShaderFromURL(this.currentVertexUrl);
      await this.effect.createRenderPipeline(vertexCode, this.fragmentShaderCode);
      this.effect.startRendering();
    } catch (error) {
      Logger.error('Failed to recompile shaders:', error);
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

  // Reload and recompile shaders upon CTRL+ENTER.
  async reloadEffect() {
    console.log("Reloading shader effect...");
    this.effect.stopRendering();
    await this.effect.reloadShaders(this.currentVertexUrl, this.currentFragmentUrl);
    this.effect.startRendering();
  }
}
