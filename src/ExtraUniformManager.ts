// src/ExtraUniformManager.ts

export interface ExtraUniformDeclaration {
    name: string;         // e.g., "uColor"
    type: string;         // e.g., "vec3<f32>" or "f32"
    size: number;         // number of floats (for layout calculation)
    initialValue: number | number[];
  }
  
  export class ExtraUniformManager {
    private declarations: ExtraUniformDeclaration[] = [];
    private uniformBuffer: GPUBuffer | null = null;
    private bufferSize: number = 0; // computed in bytes
  
    // Add a new extra uniform.
    addUniform(decl: ExtraUniformDeclaration) {
      this.declarations.push(decl);
    }
  
    // Generate a WGSL struct declaration for the extra uniforms.
    getWGSLStructDeclaration(): string {
      let lines = [`struct ExtraUniforms {`];
      for (const decl of this.declarations) {
        lines.push(`  ${decl.name}: ${decl.type},`);
      }
      lines.push(`};`);
      return lines.join("\n");
    }
  
    // Compute the total buffer size in bytes.
    computeBufferSize(): number {
      let totalFloats = 0;
      for (const decl of this.declarations) {
        totalFloats += typeof decl.initialValue === "number" ? 1 : (decl.initialValue as number[]).length;
      }
      // Each float is 4 bytes.
      return totalFloats * 4;
    }
  
    // Create the GPU buffer using the provided device.
    createBuffer(device: GPUDevice) {
      this.bufferSize = this.computeBufferSize();
      this.uniformBuffer = device.createBuffer({
        size: this.bufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
    }
  
    // Update the GPU buffer with the current values.
    updateBuffer(device: GPUDevice) {
      if (!this.uniformBuffer) return;
      let values: number[] = [];
      for (const decl of this.declarations) {
        if (typeof decl.initialValue === "number") {
          values.push(decl.initialValue);
        } else {
          values.push(...(decl.initialValue as number[]));
        }
      }
      device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array(values));
    }
  
    // Getter for the uniform buffer.
    getBuffer(): GPUBuffer | null {
      return this.uniformBuffer;
    }
  }
  