// Global uniforms provided by the ShaderForge platform
struct ForgeUniforms {
    // Basic uniforms (16 bytes)
    time: f32,
    deltaTime: f32,
    // 8 bytes padding
    
    // Viewport size (16 bytes)
    viewport: vec2<f32>, // 16-byte aligned
};
@group(0) @binding(0) var<uniform> forge: ForgeUniforms;

@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
    let color = vec3<f32>(
        fragUV.x,
        fragUV.y,
        sin(forge.time) * 0.5 + 0.5
    );
    
    return vec4<f32>(color, 1.0);
}