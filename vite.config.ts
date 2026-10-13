import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function planPersistencePlugin(): Plugin {
  return {
    name: 'vite-plugin-plan-persistence',
    configureServer(server) {
      const publicPlanPath = path.resolve(__dirname, 'public/sample.plan');
      const templatePlanPath = path.resolve(__dirname, 'sample.plan');

      // Ensure public/sample.plan exists on server startup
      if (!fs.existsSync(publicPlanPath) && fs.existsSync(templatePlanPath)) {
        fs.copyFileSync(templatePlanPath, publicPlanPath);
        console.log('[PlanPersistence] Initialized public/sample.plan from template sample.plan');
      }

      // Endpoint to save working plan to public/sample.plan
      server.middlewares.use('/api/save-plan', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              // Validate JSON payload
              JSON.parse(body);

              // Save to public/sample.plan (working plan)
              fs.writeFileSync(publicPlanPath, body, 'utf8');

              // Also sync to dist/sample.plan if dist directory exists
              const distPlanPath = path.resolve(__dirname, 'dist/sample.plan');
              if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
                fs.writeFileSync(distPlanPath, body, 'utf8');
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
            } catch (err: any) {
              console.error('[PlanPersistence] Failed to write plan:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });

      // Endpoint to reset working plan to template sample.plan
      server.middlewares.use('/api/reset-plan', (req, res, next) => {
        if (req.method === 'POST') {
          try {
            if (fs.existsSync(templatePlanPath)) {
              fs.copyFileSync(templatePlanPath, publicPlanPath);
              const content = fs.readFileSync(publicPlanPath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, plan: content }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Base template sample.plan not found' }));
            }
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), planPersistencePlugin()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@services': path.resolve(__dirname, './src/services'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
