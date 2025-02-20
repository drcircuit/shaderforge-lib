declare module 'shaderforge-lib' {
    export interface ShaderforgeOptions {
      canvas?: HTMLCanvasElement;
      container: HTMLElement;
      width?: number;
      height?: number;
      enableEditor?: boolean;
    }
  
    export interface ShaderAsset {
      id: string;
      type: 'texture' | 'cubemap' | 'audio';
      data: any;
      binding: number;
    }
  
    export class ShaderforgeComponent {
      constructor(container: HTMLElement, options?: ShaderforgeOptions);
      initialize(): Promise<void>;
      loadShaders(vertexShader: string, fragmentShader: string): Promise<void>;
      setShaders(vertex: string, fragment: string, isUrl?: boolean): Promise<void>;
      setShaderURLs(vertexUrl: string, fragmentUrl: string): Promise<void>;
      reloadEffect(): Promise<void>;
      dispose(): void;
      setSize(width: number, height: number): void;
      addAsset(asset: ShaderAsset): Promise<void>;
      removeAsset(id: string): void;
      private resizeCanvas(): void;
      private recompileShaders(): Promise<void>;
    }
  
    export class WebGPUShaderEffect {
      constructor(canvas: HTMLCanvasElement);
      initialize(): Promise<void>;
      createRenderPipeline(vertexShaderCode: string, fragmentShaderCode: string): Promise<void>;
      startRendering(): void;
      stopRendering(): void;
      destroyPipeline(): void;
    }
  
    export class ShaderEditor {
      constructor(container: HTMLElement, onUpdate: (code: string) => void);
      setCode(code: string): void;
      toggle(): void;
      show(): void;
      hide(): void;
    }
  
    export class Logger {
      static log(message: string, data?: any): void;
      static error(message: string, error?: any): void;
      static warn(message: string, data?: any): void;
      static setDebug(enabled: boolean): void;
    }
  
    export const DefaultVertexShader: string;
    export const DefaultFragmentShader: string;
  }