import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{target:'es2022',chunkSizeWarningLimit:800,rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/three/')?'three':undefined}}},worker:{format:'es'}});
