/* ═══════════════════════════════════════════════
   BLOOM — Bulletproof Interactive Blooming Flower
   ═══════════════════════════════════════════════ */

// ── Canvases ─────────────────────────────────────
const flowerCanvas  = document.getElementById('flower-canvas');
const sparkleCanvas = document.getElementById('sparkle-canvas');
const camCanvas     = document.getElementById('cam-canvas');
const fc = flowerCanvas.getContext('2d');
const sc = sparkleCanvas.getContext('2d');
const cc = camCanvas.getContext('2d');
const videoEl = document.getElementById('webcam');

camCanvas.width  = 320;
camCanvas.height = 240;

// ── UI Refs ───────────────────────────────────────
const statusPill   = document.getElementById('status-pill');
const statusLabel  = document.getElementById('status-label');
const bloomFill    = document.getElementById('bloom-fill');
const bloomValue   = document.getElementById('bloom-value');
const instructions = document.getElementById('instructions');
const startBtn     = document.getElementById('start-btn');
const camPreview   = document.getElementById('cam-preview');
const toastEl      = document.getElementById('toast');

// ── State ─────────────────────────────────────────
let bloomAmount    = 0;
let targetBloom    = 0;
let handDetected   = false;
let frameCount     = 0;
let particles      = [];
let celebrating    = false;
let celebrateTimer = 0;
let prevBloom      = 0;
let trackingMode   = 'idle'; // 'mediapipe', 'fallback', 'mouse', 'idle'

// ── Window Resize ─────────────────────────────────
function resize() {
  flowerCanvas.width  = sparkleCanvas.width  = window.innerWidth;
  flowerCanvas.height = sparkleCanvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── Toast & Status Helpers ────────────────────────
let toastTimer;
function showToast(msg, ms = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function setStatus(cls, text) {
  statusPill.className = 'status-pill ' + (cls || '');
  statusLabel.textContent = text;
}

let overlayDone = false;
function dismissOverlay() {
  if (overlayDone) return;
  overlayDone = true;
  instructions.classList.add('hidden');
}

/* ═══════════════════════════════════════════════
   BEAUTIFUL FLOWER RENDER ENGINE
   ═══════════════════════════════════════════════ */
const PETAL_HUES = [330, 280, 350, 310, 200, 260, 30, 290];

function petalGrad(ctx, cx, cy, len, hue, bloom) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy - len * 0.4, len);
  const s = 65 + bloom * 25, l = 55 + bloom * 15;
  g.addColorStop(0,   `hsla(${hue},${s}%,${l+12}%,0.97)`);
  g.addColorStop(0.5, `hsla(${hue},${s}%,${l}%,0.85)`);
  g.addColorStop(1,   `hsla(${hue+20},${s}%,${l-12}%,0.5)`);
  return g;
}

function drawPetal(ctx, cx, cy, len, wid, angle, fill) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo( wid*0.9, -len*0.25,  wid*0.7, -len*0.8, 0, -len);
  ctx.bezierCurveTo(-wid*0.7, -len*0.8,  -wid*0.9, -len*0.25, 0, 0);
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid*0.08, -len*0.5, 0, -len*0.95);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawFlower(bloom) {
  const cx = flowerCanvas.width / 2, cy = flowerCanvas.height / 2;
  const base = Math.min(cx, cy) * 0.52;

  // Glow
  const glowR = base * (0.8 + bloom * 0.8);
  const gGlow = fc.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  const gh = 280 + bloom * 60;
  gGlow.addColorStop(0,   `hsla(${gh},80%,65%,${0.05 + bloom * 0.2})`);
  gGlow.addColorStop(0.5, `hsla(${gh},80%,55%,${0.02 + bloom * 0.08})`);
  gGlow.addColorStop(1,   'transparent');
  fc.beginPath(); fc.arc(cx, cy, glowR, 0, Math.PI * 2);
  fc.fillStyle = gGlow; fc.fill();

  // Outer petals (8)
  const oLen = base * (0.3 + bloom * 0.7);
  const oWid = oLen * (0.27 + bloom * 0.12);
  for (let i = 0; i < 8; i++) {
    fc.globalAlpha = 0.45 + bloom * 0.45;
    drawPetal(fc, cx, cy, oLen, oWid, (i/8)*Math.PI*2 + Math.PI/8 - Math.PI/2, petalGrad(fc, cx, cy, oLen, PETAL_HUES[i], bloom));
  }

  // Mid petals (6)
  const mLen = base * (0.25 + bloom * 0.55);
  const mWid = mLen * (0.31 + bloom * 0.14);
  for (let i = 0; i < 6; i++) {
    fc.globalAlpha = 0.6 + bloom * 0.35;
    drawPetal(fc, cx, cy, mLen, mWid, (i/6)*Math.PI*2 + Math.PI/6 - Math.PI/2, petalGrad(fc, cx, cy, mLen, PETAL_HUES[(i+1)%8]+25, bloom));
  }

  // Inner petals (5)
  const iLen = base * (0.16 + bloom * 0.4);
  const iWid = iLen * (0.36 + bloom * 0.16);
  for (let i = 0; i < 5; i++) {
    fc.globalAlpha = 0.75 + bloom * 0.25;
    drawPetal(fc, cx, cy, iLen, iWid, (i/5)*Math.PI*2 - Math.PI/2, petalGrad(fc, cx, cy, iLen, PETAL_HUES[(i+3)%8]+50, bloom));
  }
  fc.globalAlpha = 1;

  // Stamens
  if (bloom > 0.25) {
    const sa = (bloom - 0.25) / 0.75;
    const sr = base * 0.14 * bloom;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = sr * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7)));
      fc.beginPath();
      fc.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r, 2.5 + bloom*3.5, 0, Math.PI*2);
      fc.fillStyle = `rgba(251,191,36,${sa * 0.9})`;
      fc.fill();
    }
  }

  // Center
  const cr = base * (0.065 + bloom * 0.04);
  const gC = fc.createRadialGradient(cx - cr*0.2, cy - cr*0.2, 0, cx, cy, cr);
  gC.addColorStop(0, '#fff5d4');
  gC.addColorStop(0.4, '#fbbf24');
  gC.addColorStop(1, '#78350f');
  fc.beginPath(); fc.arc(cx, cy, cr, 0, Math.PI*2); fc.fillStyle = gC; fc.fill();

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + frameCount * 0.01;
    fc.beginPath();
    fc.arc(cx + Math.cos(a)*cr*0.65, cy + Math.sin(a)*cr*0.65, 1.5, 0, Math.PI*2);
    fc.fillStyle = 'rgba(251,191,36,0.9)'; fc.fill();
  }

  // Stem
  const sBot = cy + base * 1.12, sTop = cy + cr * 0.9;
  const wave = Math.sin(frameCount * 0.016) * 9 * bloom;
  fc.beginPath(); fc.moveTo(cx, sBot);
  fc.bezierCurveTo(cx + wave, cy + base*0.7, cx - wave, cy + base*0.35, cx, sTop);
  const gs = fc.createLinearGradient(cx, sBot, cx, sTop);
  gs.addColorStop(0, '#14532d'); gs.addColorStop(1, '#4ade80');
  fc.strokeStyle = gs; fc.lineWidth = 4 + bloom*2; fc.lineCap = 'round'; fc.stroke();

  // Leaves
  if (bloom > 0.08) {
    const alpha = Math.min(1, (bloom - 0.08) / 0.4);
    [[-1, 0.68], [1, 0.52]].forEach(([side, fy]) => {
      const lLen = 45 + bloom * 35;
      fc.save(); fc.globalAlpha = alpha * 0.88;
      fc.translate(cx + side*5, cy + base*fy);
      fc.rotate(side * (0.55 + bloom*0.45));
      fc.beginPath(); fc.moveTo(0, 0);
      fc.bezierCurveTo(side*lLen*0.5, -lLen*0.3, side*lLen*0.3, -lLen*0.8, 0, -lLen);
      fc.bezierCurveTo(side*lLen*0.1, -lLen*0.5, side*lLen*0.15, -lLen*0.2, 0, 0);
      const lg = fc.createLinearGradient(0, 0, side*lLen*0.4, -lLen);
      lg.addColorStop(0, '#15803d'); lg.addColorStop(1, '#4ade80');
      fc.fillStyle = lg; fc.fill(); fc.restore();
    });
  }

  // Radial guide lines
  fc.save(); fc.globalAlpha = 0.03 + bloom*0.03;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    fc.beginPath();
    fc.moveTo(cx + Math.cos(a)*base*0.1, cy + Math.sin(a)*base*0.1);
    fc.lineTo(cx + Math.cos(a)*base*0.85, cy + Math.sin(a)*base*0.85);
    fc.strokeStyle = '#a855f7'; fc.lineWidth = 0.5;
    fc.setLineDash([3, 8]); fc.stroke(); fc.setLineDash([]);
  }
  fc.restore();
}

/* ═══════════════════════════════════════════════
   PARTICLE SYSTEM
   ═══════════════════════════════════════════════ */
class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 9;
    this.vy = (Math.random() - 1.8) * 8;
    this.life = 1;
    this.decay = 0.012 + Math.random() * 0.02;
    this.size = 3 + Math.random() * 7;
    this.hue  = Math.random() * 360;
    this.type = Math.floor(Math.random() * 3);
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.18; this.vx *= 0.99;
    this.life -= this.decay;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.fillStyle = `hsl(${this.hue},90%,65%)`;
    if (this.type === 0) {
      ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 1) {
      const s = this.size, n = 5, r2 = s * 0.4;
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = i / n / 2 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r2 : s;
        i ? ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
    } else {
      const s = this.size * 0.75;
      ctx.beginPath(); ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s, -s*0.5, -s*1.5, s*0.5, 0, s*1.2);
      ctx.bezierCurveTo(s*1.5, s*0.5, s, -s*0.5, 0, s*0.3);
      ctx.fill();
    }
    ctx.restore();
  }
}

function spawnParticles(n = 14) {
  const cx = flowerCanvas.width / 2, cy = flowerCanvas.height / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 90;
    particles.push(new Particle(cx + Math.cos(a)*r, cy + Math.sin(a)*r));
  }
}

/* ═══════════════════════════════════════════════
   MEDIAPIPE HAND TRACKING & VISUAL FALLBACK MODE
   ═══════════════════════════════════════════════ */
const PINCH_CLOSE = 0.045;
const PINCH_OPEN  = 0.20;

let handsObj  = null;
let cameraObj = null;

function pinchDist(lm) {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
}

function initMediaPipe() {
  if (typeof Hands === 'undefined') {
    startVisualFallback();
    return;
  }

  try {
    handsObj = new Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsObj.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.55
    });

    handsObj.onResults(results => {
      // Draw mirrored cam preview
      try {
        cc.save(); cc.scale(-1, 1);
        cc.drawImage(results.image, -camCanvas.width, 0, camCanvas.width, camCanvas.height);
        cc.restore();
      } catch(_) {}

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        handDetected = true;
        trackingMode = 'mediapipe';

        try {
          drawConnectors(cc, lm, HAND_CONNECTIONS, { color: 'rgba(168,85,247,0.7)', lineWidth: 2 });
          drawLandmarks(cc, lm, { color: '#ff6fa8', lineWidth: 1, radius: 3 });
        } catch(_) {}

        const dist = pinchDist(lm);
        targetBloom = Math.max(0, Math.min(1, (dist - PINCH_CLOSE) / (PINCH_OPEN - PINCH_CLOSE)));

        if (targetBloom > 0.8)       setStatus('blooming', 'Blooming! 🌸');
        else if (targetBloom < 0.15) setStatus('ready', 'Pinching 🤏');
        else                          setStatus('ready', 'Hand detected ✋');
        dismissOverlay();
      } else {
        handDetected = false;
        targetBloom  = Math.max(0, targetBloom - 0.01);
        setStatus('ready', 'Show your hand ✋');
      }
    });

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      .then(stream => {
        videoEl.srcObject = stream;
        videoEl.play();
        camPreview.classList.add('visible');

        cameraObj = new Camera(videoEl, {
          onFrame: async () => {
            try {
              if (handsObj) await handsObj.send({ image: videoEl });
            } catch(e) {
              console.warn('[Bloom] Frame skip:', e);
            }
          },
          width: 640, height: 480
        });

        cameraObj.start().catch(() => startVisualFallback());
        setStatus('ready', 'Show your hand ✋');
        showToast('🌸 Hand tracking ready!', 2500);
      })
      .catch(() => startVisualFallback());

  } catch(e) {
    console.warn('[Bloom] MediaPipe init error, starting fallback:', e);
    startVisualFallback();
  }
}

/* ═══════════════════════════════════════════════
   LIGHTWEIGHT VISUAL CAMERA FALLBACK
   Works 100% without external AI models or WebGL!
   ═══════════════════════════════════════════════ */
let prevFrameData = null;

function startVisualFallback() {
  trackingMode = 'fallback';
  navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } })
    .then(stream => {
      videoEl.srcObject = stream;
      videoEl.play();
      camPreview.classList.add('visible');
      setStatus('ready', 'Move hand or Drag screen ✋');
      showToast('💡 Camera Ready! Move hand or drag flower to bloom.', 4000);
      dismissOverlay();
      processVisualMotion();
    })
    .catch(() => {
      setStatus('ready', 'Drag flower to bloom 🖱');
      showToast('💡 Drag left or right on flower to bloom!', 4000);
      dismissOverlay();
    });
}

function processVisualMotion() {
  if (videoEl.readyState >= 2) {
    cc.save(); cc.scale(-1, 1);
    cc.drawImage(videoEl, -camCanvas.width, 0, camCanvas.width, camCanvas.height);
    cc.restore();

    try {
      const frame = cc.getImageData(0, 0, camCanvas.width, camCanvas.height);
      const data = frame.data;
      let motionScore = 0;

      if (prevFrameData) {
        for (let i = 0; i < data.length; i += 16) {
          const diff = Math.abs(data[i] - prevFrameData[i]) +
                       Math.abs(data[i+1] - prevFrameData[i+1]) +
                       Math.abs(data[i+2] - prevFrameData[i+2]);
          if (diff > 45) motionScore++;
        }
      }
      prevFrameData = data;

      if (trackingMode === 'fallback' && !mouseDown) {
        const normMotion = Math.min(1, motionScore / 300);
        if (normMotion > 0.05) {
          targetBloom = Math.max(0, Math.min(1, targetBloom + normMotion * 0.05));
          setStatus('blooming', 'Hand Motion Blooming! 🌸');
        } else {
          targetBloom = Math.max(0, targetBloom - 0.005);
        }
      }
    } catch(_) {}
  }
  setTimeout(processVisualMotion, 60);
}

/* ═══════════════════════════════════════════════
   START BUTTON EVENT
   ═══════════════════════════════════════════════ */
startBtn.addEventListener('click', () => {
  dismissOverlay();
  setStatus('', 'Starting…');
  initMediaPipe();
});

/* ═══════════════════════════════════════════════
   MAIN 60FPS ANIMATION LOOP
   ═══════════════════════════════════════════════ */
function loop() {
  requestAnimationFrame(loop);
  frameCount++;

  bloomAmount += (targetBloom - bloomAmount) * 0.07;
  const pct = Math.round(bloomAmount * 100);
  bloomFill.style.width  = pct + '%';
  bloomValue.textContent = pct + '%';

  if (bloomAmount > 0.88 && prevBloom < 0.88) {
    spawnParticles(25);
    celebrating = true;
    celebrateTimer = 0;
    showToast('🌸 Fully Bloomed!', 2500);
  }
  if (celebrating && bloomAmount > 0.75) {
    celebrateTimer++;
    if (celebrateTimer % 7 === 0) spawnParticles(5);
    if (celebrateTimer > 280) celebrating = false;
  } else if (bloomAmount < 0.5) celebrating = false;
  prevBloom = bloomAmount;

  fc.clearRect(0, 0, flowerCanvas.width, flowerCanvas.height);
  drawFlower(bloomAmount);
  sc.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.update(); p.draw(sc); }
}
loop(); // Render flower immediately

/* ═══════════════════════════════════════════════
   MOUSE & TOUCH CONTROLS (ALWAYS WORKS)
   ═══════════════════════════════════════════════ */
let mouseDown = false, mouseX0 = 0, bloomX0 = 0;

flowerCanvas.addEventListener('mousedown', e => {
  mouseDown = true;
  mouseX0 = e.clientX;
  bloomX0 = targetBloom;
});
window.addEventListener('mouseup', () => mouseDown = false);
window.addEventListener('mousemove', e => {
  if (!mouseDown) return;
  const delta = (e.clientX - mouseX0) / (window.innerWidth * 0.6);
  targetBloom = Math.max(0, Math.min(1, bloomX0 + delta));
  setStatus('ready', 'Dragging 🖱');
});

let t0 = null;
flowerCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    mouseDown = true;
    mouseX0 = e.touches[0].clientX;
    bloomX0 = targetBloom;
  } else if (e.touches.length === 2) {
    t0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }
}, { passive: true });

flowerCanvas.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && mouseDown) {
    const delta = (e.touches[0].clientX - mouseX0) / (window.innerWidth * 0.6);
    targetBloom = Math.max(0, Math.min(1, bloomX0 + delta));
    setStatus('ready', 'Swiping 📱');
  } else if (e.touches.length === 2 && t0 !== null) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    targetBloom = Math.max(0, Math.min(1, d / 350));
    setStatus('ready', 'Pinching 📱');
  }
}, { passive: true });
