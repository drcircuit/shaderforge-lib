import { ShaderforgeComponent } from "shaderforge-lib";

// Get the container element
const container = document.getElementById("shaderforge-container");
if (!container) {
  throw new Error("Container element not found");
}

// Create and initialize the effect
const effect = new ShaderforgeComponent(container);
effect.setShaderURLs("shaders/vertex.wgsl", "shaders/fragment.wgsl");
effect.initialize().catch(console.error);