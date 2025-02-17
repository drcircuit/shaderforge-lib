// src/globalUniformsWGSL.ts

export const globalUniformsWGSL = /* wgsl */ `
struct GlobalUniforms {
  time: f32,          // current time in seconds
  deltaTime: f32,     // time elapsed since the previous frame in seconds,
  frame: f32,         // frame count (as a float)
  key: f32,           // key code of last pressed key
  mouse: vec2<f32>,   // mouse coordinates (normalized between 0 and 1)
  viewport: vec2<f32>,// viewport dimensions in pixels
  fftData: array<f32, 64> // FFT data from the sound channel (placeholder)
};

@group(0) @binding(0)
var<uniform> forge: GlobalUniforms;
`;
