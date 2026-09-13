import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { host: '0.0.0.0', watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } } });
