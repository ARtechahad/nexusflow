import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_ROUTES } from '../src/data/studioData';
import { renderPublicRouteHtml } from '../src/ssr/renderPublicRoute';

const distDir = path.resolve(process.cwd(), 'dist');
const templatePath = path.join(distDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('[prerender] dist/index.html not found. Run vite build first.');
  process.exit(1);
}

const templateHtml = fs.readFileSync(templatePath, 'utf8');

// Save pristine SPA template (without prerendered home HTML) for noindex workspace/auth routes
fs.writeFileSync(path.join(distDir, 'app-shell.html'), templateHtml, 'utf8');

for (const route of PUBLIC_ROUTES) {
  const { html } = renderPublicRouteHtml(templateHtml, route);
  if (route === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
    console.log('[prerender] Wrote dist/index.html');
  } else {
    const cleanRoute = route.replace(/^\//, '');
    const routeDir = path.join(distDir, cleanRoute);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf8');
    console.log(`[prerender] Wrote dist/${cleanRoute}/index.html`);
  }
}

// Generate static 404.html with real noindex metadata
const { html: notFoundHtml } = renderPublicRouteHtml(templateHtml, '/__404__');
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');
console.log('[prerender] Wrote dist/404.html');
