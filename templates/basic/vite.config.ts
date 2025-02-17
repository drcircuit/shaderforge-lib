import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    open: true
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
          vendor: ['shaderforge-lib']
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wgsl')) {
            return 'shaders/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  },
  resolve: {
    alias: {
      'shaderforge-lib': resolve(__dirname, '../../dist/package')
    }
  },
  assetsInclude: ['**/*.wgsl'] // Treat WGSL files as assets
});