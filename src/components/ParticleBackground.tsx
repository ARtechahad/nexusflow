import React, { useEffect, useRef } from 'react';

/**
 * ============================================================================
 * GOOGLE ANTIGRAVITY INTERACTIVE PARTICLES ENGINE
 * Reference: https://antigravity.google/?referrer=AISTUDIO
 * ============================================================================
 * Features:
 * - Authentic Google Antigravity rounded-capsule pill dashes & particles
 * - Dual-ring wave displacement physics with Simplex Noise field
 * - Tangential wave orientation (particles orient along the expanding shockwave)
 * - Autonomous breathing orbit when idle + smooth spring tracking on cursor movement
 * - High-performance GPU accelerated WebGL with automatic 2D fallback
 * - Sits behind all UI (pointer-events: none) without intercepting clicks or inputs
 */

export interface ParticleBackgroundProps {
  /** Opacity of the background particle layer (0.0 - 1.0) */
  opacity?: number;
  /** Optional custom CSS classes */
  className?: string;
  /** Particle density multiplier (0.5 - 2.0) */
  densityScale?: number;
  /** Ring displacement force (matches Google Antigravity 0.15) */
  ringDisplacement?: number;
  /** Whether the canvas is fixed to viewport or absolute to hero container */
  positionMode?: 'fixed' | 'absolute';
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  opacity = 0.85,
  className = '',
  densityScale = 1.0,
  ringDisplacement = 0.16,
  positionMode = 'absolute'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check dark mode preference
    const isDarkMode = document.documentElement.classList.contains('dark') || 
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Google Antigravity Color Palettes (Navy, periwinkle, royal blue, emerald glow)
    const colors = isDarkMode
      ? {
          c1: [0.443, 0.537, 1.0],   // #7189ff (Antigravity Soft Periwinkle Blue)
          c2: [0.188, 0.455, 0.976], // #3074f9 (Antigravity Google Blue)
          c3: [0.063, 0.725, 0.506]  // #10b981 (High-trust Emerald Glow)
        }
      : {
          c1: [0.172, 0.392, 0.929], // #2c64ed (Vibrant Royal)
          c2: [0.02, 0.588, 0.412],  // #059669 (Emerald)
          c3: [0.392, 0.455, 0.545]  // #64748b (Refined Slate)
        };

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      }) || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    } catch {
      gl = null;
    }

    let animationFrameId: number;
    let destroyed = false;

    // ========================================================================
    // WEBGL IMPLEMENTATION (Authentic Antigravity Shaders & Physics)
    // ========================================================================
    if (gl) {
      // Vertex Shader with Ashima Simplex Noise 3D & Antigravity Ring Waves
      const vsSource = `
        precision highp float;
        attribute vec2 aPosition;
        attribute vec4 aSeed;

        uniform float uTime;
        uniform vec2 uRingPos;
        uniform float uRingRadius;
        uniform float uRingWidth;
        uniform float uRingWidth2;
        uniform float uRingDisplacement;
        uniform float uParticleScale;
        uniform vec2 uResolution;

        varying vec2 vLocalPos;
        varying float vScale;
        varying float vVelocity;
        varying float vAngle;
        varying vec4 vSeed;

        // --- Ashima Arts / Stefan Gustavson Simplex Noise 3D ---
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          vec2 curentPos = aPosition;

          // Aspect-corrected space for circular wave geometry
          vec2 aspectPos = vec2(curentPos.x * aspect, curentPos.y);
          vec2 aspectRingPos = vec2(uRingPos.x * aspect, uRingPos.y);

          float time = uTime * 0.45;
          float dist = distance(aspectPos, aspectRingPos);

          // Google Antigravity wave interference math
          float noise0 = snoise(vec3(curentPos * 0.25 + vec2(18.4924, 72.9744), time * 0.5));
          float dist1 = distance(aspectPos + (noise0 * 0.006), aspectRingPos);

          float t = smoothstep(uRingRadius - (uRingWidth * 2.0), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
          float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.0), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
          float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

          t = pow(max(t, 0.0), 2.0);
          t2 = pow(max(t2, 0.0), 3.0);
          t += t2 * 2.8;
          t += t3 * 0.35;
          t += snoise(vec3(curentPos * 25.0 + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.4;

          float nS = snoise(vec3(curentPos * 2.2 + vec2(18.4924, 72.9744), time * 0.5));
          t += pow(max((nS + 1.5) * 0.5, 0.0), 2.0) * 0.5;

          // Multi-frequency organic fluid displacement
          float noise1 = snoise(vec3(curentPos * 3.5 + vec2(88.494, 32.4397), time * 0.35));
          float noise2 = snoise(vec3(curentPos * 3.5 + vec2(50.904, 120.947), time * 0.35));
          float noise3 = snoise(vec3(curentPos * 18.0 + vec2(18.4924, 72.9744), time * 0.5));
          float noise4 = snoise(vec3(curentPos * 18.0 + vec2(50.904, 120.947), time * 0.5));

          vec2 disp = vec2(noise1, noise2) * 0.028;
          disp += vec2(noise3, noise4) * 0.006;

          disp.x += sin((curentPos.x * 18.0) + (time * 3.5)) * 0.015 * clamp(dist, 0.0, 1.0);
          disp.y += cos((curentPos.y * 18.0) + (time * 2.8)) * 0.015 * clamp(dist, 0.0, 1.0);

          // Antigravity ring displacement impulse
          vec2 ringDir = (uRingPos - (curentPos + disp));
          vec2 push = ringDir * pow(max(t2, 0.0), 0.75) * uRingDisplacement;

          vec2 finalPos = curentPos + disp - push;

          // Particle orientation along tangent + radial wave
          float noiseAngle = snoise(vec3(curentPos * 9.0 + vec2(18.4924, 72.9744), uTime * 0.8));
          float angle = atan(aspectPos.y - aspectRingPos.y, aspectPos.x - aspectRingPos.x);
          vAngle = angle + (noiseAngle * 0.45);

          vLocalPos = finalPos;
          vScale = clamp(0.25 + t * 0.75, 0.15, 1.75);
          vVelocity = clamp(t2 * 2.2 + t * 0.6, 0.0, 1.0);
          vSeed = aSeed;

          gl_Position = vec4(finalPos.x, finalPos.y, 0.0, 1.0);
          gl_PointSize = vScale * 11.5 * uParticleScale;
        }
      `;

      // Fragment Shader: Antigravity Capsule Dash Shape & Gradient
      const fsSource = `
        precision highp float;
        varying vec2 vLocalPos;
        varying float vScale;
        varying float vVelocity;
        varying float vAngle;
        varying vec4 vSeed;

        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uAlpha;

        // Signed distance function for rounded capsule box (Google Antigravity style)
        float sdRoundBox(in vec2 p, in vec2 b, in vec4 r) {
          r.xy = (p.x > 0.0) ? r.xy : r.zw;
          r.x  = (p.y > 0.0) ? r.x  : r.y;
          vec2 q = abs(p) - b + r.x;
          return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
        }

        vec2 rotate(vec2 v, float a) {
          float s = sin(a);
          float c = cos(a);
          return mat2(c, s, -s, c) * v;
        }

        void main() {
          vec2 uv = gl_PointCoord.xy - vec2(0.5);
          uv.y *= -1.0;

          // Rotate dash towards ripple wavefront
          uv = rotate(uv, -vAngle);

          // Render pill/capsule shape with crisp curvature
          float rounded = sdRoundBox(uv, vec2(0.32, 0.11), vec4(0.09));
          rounded = smoothstep(0.06, 0.0, rounded);

          if (rounded < 0.01) {
            discard;
          }

          // Antigravity gradient transition
          float progress = clamp(vVelocity * 1.2 + vSeed.x * 0.25, 0.0, 1.0);
          vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 0.55, progress));
          col = mix(col, uColor3, smoothstep(0.55, 1.0, progress));

          float a = uAlpha * rounded * smoothstep(0.05, 0.25, vScale);
          if (a < 0.01) {
            discard;
          }

          gl_FragColor = vec4(col, a);
        }
      `;

      // Shader Compilation Helper
      const compileShader = (type: number, source: string) => {
        if (!gl) return null;
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('Antigravity Shader compile failed:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);

      if (!vs || !fs) {
        return;
      }

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Program link failed:', gl.getProgramInfoLog(program));
        return;
      }

      gl.useProgram(program);

      // Attribute and Uniform Locations
      const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
      const aSeedLoc = gl.getAttribLocation(program, 'aSeed');

      const uTimeLoc = gl.getUniformLocation(program, 'uTime');
      const uRingPosLoc = gl.getUniformLocation(program, 'uRingPos');
      const uRingRadiusLoc = gl.getUniformLocation(program, 'uRingRadius');
      const uRingWidthLoc = gl.getUniformLocation(program, 'uRingWidth');
      const uRingWidth2Loc = gl.getUniformLocation(program, 'uRingWidth2');
      const uRingDisplacementLoc = gl.getUniformLocation(program, 'uRingDisplacement');
      const uParticleScaleLoc = gl.getUniformLocation(program, 'uParticleScale');
      const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
      const uColor1Loc = gl.getUniformLocation(program, 'uColor1');
      const uColor2Loc = gl.getUniformLocation(program, 'uColor2');
      const uColor3Loc = gl.getUniformLocation(program, 'uColor3');
      const uAlphaLoc = gl.getUniformLocation(program, 'uAlpha');

      // Generate Grid & Poisson-style Particle Coordinates with Airy Antigravity Spacing
      // Antigravity particles have ample breathing room so each pill floats cleanly without crowding
      const gridCols = Math.round(42 * Math.sqrt(densityScale));
      const gridRows = Math.round(24 * Math.sqrt(densityScale));
      const particleCount = gridCols * gridRows;

      const positions = new Float32Array(particleCount * 2);
      const seeds = new Float32Array(particleCount * 4);

      let pIdx = 0;
      let sIdx = 0;

      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          // Hexagonal alternating row offset for organic, non-rigid distribution
          const xNorm = ((c + (r % 2 === 0 ? 0.5 : 0)) / gridCols) * 2.6 - 1.3;
          const yNorm = (r / gridRows) * 2.6 - 1.3;

          // Controlled subtle jitter to preserve distinct space between particles
          const jitterX = (Math.random() - 0.5) * (0.6 / gridCols);
          const jitterY = (Math.random() - 0.5) * (0.6 / gridRows);

          positions[pIdx++] = xNorm + jitterX;
          positions[pIdx++] = yNorm + jitterY;

          seeds[sIdx++] = Math.random();
          seeds[sIdx++] = Math.random();
          seeds[sIdx++] = Math.random();
          seeds[sIdx++] = Math.random();
        }
      }

      // VBO Buffers
      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const seedBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

      // Mouse State & Ring Tracker
      const state = {
        ringX: 0,
        ringY: 0,
        targetX: 0,
        targetY: 0,
        isUserInteracting: false,
        lastInteractionTime: performance.now()
      };

      const handlePointerMove = (e: PointerEvent | MouseEvent) => {
        // Map viewport pixel coordinates to WebGL normalized coordinates (-1 to 1)
        const rect = canvas.getBoundingClientRect();
        state.targetX = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
        state.targetY = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
        state.isUserInteracting = true;
        state.lastInteractionTime = performance.now();
      };

      const handlePointerLeave = () => {
        state.isUserInteracting = false;
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerleave', handlePointerLeave);

      // Resize Canvas Handler
      const handleResize = () => {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = positionMode === 'fixed' ? window.innerWidth : (canvas.parentElement?.clientWidth || canvas.clientWidth || window.innerWidth);
        const h = positionMode === 'fixed' ? window.innerHeight : (canvas.parentElement?.clientHeight || canvas.clientHeight || window.innerHeight);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      // Render Loop
      const startTime = performance.now();

      const render = (now: number) => {
        if (destroyed || !gl) return;

        const time = (now - startTime) * 0.001;

        // Smooth spring physics for ring following cursor
        // If user is idle (>2.5s), create organic breathing orbit across screen
        if (!state.isUserInteracting || now - state.lastInteractionTime > 3000) {
          state.targetX = Math.sin(time * 0.35) * 0.28 + Math.cos(time * 0.15) * 0.1;
          state.targetY = Math.cos(time * 0.4) * 0.24 + Math.sin(time * 0.2) * 0.08;
        }

        const lerpFactor = state.isUserInteracting ? 0.045 : 0.02;
        state.ringX += (state.targetX - state.ringX) * lerpFactor;
        state.ringY += (state.targetY - state.ringY) * lerpFactor;

        // Dynamic breathing ring radius (matches Google Antigravity)
        const ringRadius = 0.21 + Math.sin(time * 1.1) * 0.035 + Math.cos(time * 2.8) * 0.018;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(program);

        // Bind attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.enableVertexAttribArray(aPositionLoc);
        gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
        gl.enableVertexAttribArray(aSeedLoc);
        gl.vertexAttribPointer(aSeedLoc, 4, gl.FLOAT, false, 0, 0);

        // Upload uniforms
        gl.uniform1f(uTimeLoc, time);
        gl.uniform2f(uRingPosLoc, state.ringX, state.ringY);
        gl.uniform1f(uRingRadiusLoc, ringRadius);
        gl.uniform1f(uRingWidthLoc, 0.107);
        gl.uniform1f(uRingWidth2Loc, 0.05);
        gl.uniform1f(uRingDisplacementLoc, ringDisplacement);

        const particleScale = (canvas.width / 2000.0) * 0.82;
        gl.uniform1f(uParticleScaleLoc, particleScale);
        gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);

        gl.uniform3f(uColor1Loc, colors.c1[0], colors.c1[1], colors.c1[2]);
        gl.uniform3f(uColor2Loc, colors.c2[0], colors.c2[1], colors.c2[2]);
        gl.uniform3f(uColor3Loc, colors.c3[0], colors.c3[1], colors.c3[2]);
        gl.uniform1f(uAlphaLoc, opacity);

        // Draw points
        gl.drawArrays(gl.POINTS, 0, particleCount);

        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);

      return () => {
        destroyed = true;
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerleave', handlePointerLeave);
        window.removeEventListener('resize', handleResize);

        if (posBuffer) gl.deleteBuffer(posBuffer);
        if (seedBuffer) gl.deleteBuffer(seedBuffer);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (program) gl.deleteProgram(program);
      };
    } else {
      // ======================================================================
      // 2D CANVAS FALLBACK (Graceful Degrade if WebGL Disabled)
      // ======================================================================
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const mouse = { x: width * 0.5, y: height * 0.5, active: false };

      const handlePointerMove = (e: PointerEvent | MouseEvent) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });

      const cols = 45;
      const rows = 28;
      const dots: Array<{ x: number; y: number; bx: number; by: number }> = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c / cols) * width;
          const y = (r / rows) * height;
          dots.push({ x, y, bx: x, by: y });
        }
      }

      const animate2D = (t: number) => {
        if (destroyed) return;
        const time = t * 0.001;

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const dx = d.bx - mouse.x;
          const dy = d.by - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const push = Math.max(0, 1 - dist / 180) * 45;
          d.x = d.bx + (dist > 0 ? (dx / dist) * push : 0) + Math.sin(time + i) * 3;
          d.y = d.by + (dist > 0 ? (dy / dist) * push : 0) + Math.cos(time + i * 0.5) * 3;

          const angle = Math.atan2(dy, dx);
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.rotate(angle);
          ctx.fillStyle = dist < 180 ? 'rgba(49, 134, 255, 0.7)' : 'rgba(113, 137, 255, 0.4)';
          ctx.beginPath();
          ctx.roundRect(-4, -1.5, 8, 3, 1.5);
          ctx.fill();
          ctx.restore();
        }

        animationFrameId = requestAnimationFrame(animate2D);
      };

      animationFrameId = requestAnimationFrame(animate2D);

      return () => {
        destroyed = true;
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('pointermove', handlePointerMove);
      };
    }
  }, [opacity, densityScale, ringDisplacement, positionMode]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${
        positionMode === 'fixed' ? 'fixed inset-0 z-0' : 'absolute inset-0 w-full h-full z-0'
      } ${className}`}
      style={{
        position: positionMode === 'fixed' ? 'fixed' : 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}
      aria-hidden="true"
    />
  );
};
