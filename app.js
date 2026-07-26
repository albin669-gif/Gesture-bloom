/* ═══════════════════════════════════════════════
   BLOOM — Interactive Flower with MediaPipe Hands
   ═══════════════════════════════════════════════ */

// ── Canvas setup ────────────────────────────────
const flowerCanvas  = document.getElementById('flower-canvas');
const sparkleCanvas = document.getElementById('sparkle-canvas');
const camCanvas     = document.getElementById('cam-canvas');
const fc  = flowerCanvas.getContext('2d');
const sc  = sparkleCanvas.getContext('2d');
const cc  = camCanvas.getContext('2d');
const videoEl = document.getElementById('webcam');

// ── UI refs ─────────────────────────────────────
const statusPill   = document.getElementById('status-pill');
const statusLabel  = document.getElementById('status-label');
const bloomFill    = document.getElementById('bloom-fill');
const bloomValue   = document.getElementById('bloom-value');
const instructions = document.getElementById('instructions');
const startBtn     = document.getElementById('start-btn');
const camPreview   = document.getElementById('cam-preview');
const toastEl      = document.getElementById('toast');

// ── State ───────────────────────────────────────
let bloomAmount    = 0;
let targetBloom    = 0;
let handDetected   = false;
let frameCount     = 0;
let particles      = [];
let celebrating    = false;
let celebrateTimer = 0;
let prevBloomSnap  = 0;
let mediapipeReady = false;

camCanvas.width  = 320;
camCanvas.height = 240;

// ── Resize ──────────────────────────────────────
function resize() {
  flowerCanvas.width  = sparkleCanvas.width  = window.innerWidth;
  flowerCanvas.height = sparkleCanvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── Toast helper ────────────────────────────────
let toastTimer;
function showToast(msg, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ── Status helper ───────────────────────────────
function setStatus(cls, text) {
  statusPill.className = 'status-pill ' + (cls || '');
  statusLabel.textContent = text;
}

// ── Dismiss overlay ─────────────────────────────
let overlayDismissed = false;
function dismissOverlay() {
  if (overlayDismissed) return;
  overlayDismissed = true;
  instructions.classList.add('hidden');
}

/* ═══════════════════════════════════════════════
   FLOWER DRAWING
   ═══════════════════════════════════════════════ */

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
  ctx.fillStyle = fill;
  ctx.fill();
  // vein
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid*0.08, -len*0.5, 0, -len*0.95);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

const PETAL_HUES = [330, 280, 350, 310, 200, 260, 30, 290];

function drawFlower(bloom) {
  const cx = flowerCanvas.width  / 2;
  const cy = flowerCanvas.height / 2;
  const base = Math.min(cx, cy) * 0.52;

  // ─ Ambient glow (draw first, behind everything) ─
  const glowR = base * (0.8 + bloom * 0.8);
  const gGlow = fc.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  const gh = 280 + bloom * 60;
  gGlow.addColorStop(0,   `hsla(${gh},80%,65%,${0.05 + bloom * 0.2})`);
  gGlow.addColorStop(0.5, `hsla(${gh},80%,55%,${0.02 + bloom * 0.08})`);
  gGlow.addColorStop(1,   'transparent');
  fc.beginPath();
  fc.arc(cx, cy, glowR, 0, Math.PI * 2);
  fc.fillStyle = gGlow;
  fc.fill();

  // ─ Outer petals (8) ─
  const oLen = base * (0.3 + bloom * 0.7);
  const oWid = oLen * (0.27 + bloom * 0.12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const hue = PETAL_HUES[i];
    fc.globalAlpha = 0.45 + bloom * 0.45;
    drawPetal(fc, cx, cy, oLen, oWid, a - Math.PI / 2, petalGrad(fc, cx, cy, oLen, hue, bloom));
  }

  // ─ Mid petals (6) ─
  const mLen = base * (0.25 + bloom * 0.55);
  const mWid = mLen * (0.31 + bloom * 0.14);
  for (let i = 0; i < 6; i++) {
    const a   = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const hue = PETAL_HUES[(i + 1) % 8] + 25;
    fc.globalAlpha = 0.6 + bloom * 0.35;
    drawPetal(fc, cx, cy, mLen, mWid, a - Math.PI / 2, petalGrad(fc, cx, cy, mLen, hue, bloom));
  }

  // ─ Inner petals (5) ─
  const iLen = base * (0.16 + bloom * 0.4);
  const iWid = iLen * (0.36 + bloom * 0.16);
  for (let i = 0; i < 5; i++) {
    const a   = (i / 5) * Math.PI * 2;
    const hue = PETAL_HUES[(i + 3) % 8] + 50;
    fc.globalAlpha = 0.75 + bloom * 0.25;
    drawPetal(fc, cx, cy, iLen, iWid, a - Math.PI / 2, petalGrad(fc, cx, cy, iLen, hue, bloom));
  }

  fc.globalAlpha = 1;

  // ─ Stamens ─
  if (bloom > 0.25) {
    const sa = Math.max(0, (bloom - 0.25) / 0.75);
    const sr = base * 0.14 * bloom;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = sr * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7)));
      fc.beginPath();
      fc.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5 + bloom * 3.5, 0, Math.PI * 2);
      fc.fillStyle = `rgba(251,191,36,${sa * 0.9})`;
      fc.fill();
    }
  }

  // ─ Center ─
  const cr = base * (0.065 + bloom * 0.04);
  const gC = fc.createRadialGradient(cx - cr*0.2, cy - cr*0.2, 0, cx, cy, cr);
  gC.addColorStop(0, '#fff5d4');
  gC.addColorStop(0.4, '#fbbf24');
  gC.addColorStop(1, '#78350f');
  fc.beginPath();
  fc.arc(cx, cy, cr, 0, Math.PI * 2);
  fc.fillStyle = gC;
  fc.fill();

  // spinning pollen
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + frameCount * 0.01;
    fc.beginPath();
    fc.arc(cx + Math.cos(a) * cr * 0.65, cy + Math.sin(a) * cr * 0.65, 1.5, 0, Math.PI * 2);
    fc.fillStyle = 'rgba(251,191,36,0.9)';
    fc.fill();
  }

  // ─ Stem ─
  const sBot = cy + base * 1.12;
  const sTop = cy + cr * 0.9;
  const wave = Math.sin(frameCount * 0.016) * 9 * bloom;
  fc.beginPath();
  fc.moveTo(cx, sBot);
  fc.bezierCurveTo(cx + wave, cy + base * 0.7, cx - wave, cy + base * 0.35, cx, sTop);
  const gs = fc.createLinearGradient(cx, sBot, cx, sTop);
  gs.addColorStop(0, '#14532d');
  gs.addColorStop(1, '#4ade80');
  fc.strokeStyle = gs;
  fc.lineWidth   = 4 + bloom * 2;
  fc.lineCap     = 'round';
  fc.stroke();

  // ─ Leaves ─
  if (bloom > 0.08) drawLeaves(fc, cx, cy, base, bloom);

  // ─ Radial guide ─
  fc.save();
  fc.globalAlpha = 0.035 + bloom * 0.03;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    fc.beginPath();
    fc.moveTo(cx + Math.cos(a)*base*0.1, cy + Math.sin(a)*base*0.1);
    fc.lineTo(cx + Math.cos(a)*base*0.85, cy + Math.sin(a)*base*0.85);
    fc.strokeStyle = '#a855f7';
    fc.lineWidth   = 0.5;
    fc.setLineDash([3, 8]);
    fc.stroke();
    fc.setLineDash([]);
  }
  fc.restore();
}

function drawLeaves(ctx, cx, cy, base, bloom) {
  const alpha = Math.min(1, (bloom - 0.08) / 0.4);
  [[-1, 0.68], [1, 0.52]].forEach(([side, fy]) => {
    const stemY = cy + base * fy;
    const lx = cx + side * 5;
    const lLen = 45 + bloom * 35;
    ctx.save();
    ctx.globalAlpha = alpha * 0.88;
    ctx.translate(lx, stemY);
    ctx.rotate(side * (0.55 + bloom * 0.45));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side*lLen*0.5, -lLen*0.3, side*lLen*0.3, -lLen*0.8, 0, -lLen);
    ctx.bezierCurveTo(side*lLen*0.1, -lLen*0.5, side*lLen*0.15, -lLen*0.2, 0, 0);
    const lg = ctx.createLinearGradient(0, 0, side*lLen*0.4, -lLen);
    lg.addColorStop(0, '#15803d');
    lg.addColorStop(1, '#4ade80');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.restore();
  });
}

/* ═══════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════ */

class Particle {
  constructor(x, y) {
    this.x     = x; this.y = y;
    this.vx    = (Math.random() - 0.5) * 9;
    this.vy    = (Math.random() - 1.8) * 8;
    this.life  = 1;
    this.decay = 0.012 + Math.random() * 0.02;
    this.size  = 3 + Math.random() * 7;
    this.hue   = Math.random() * 360;
    this.type  = Math.floor(Math.random() * 3);
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
      ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI*2); ctx.fill();
    } else if (this.type === 1) {
      const s = this.size, n = 5, inner = s*0.4;
      ctx.beginPath();
      for (let i = 0; i < n*2; i++) {
        const a = i/n/2*Math.PI*2 - Math.PI/2, r = i%2===0?s:inner;
        i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
    } else {
      const s = this.size * 0.75;
      ctx.beginPath();
      ctx.moveTo(0, s*0.3);
      ctx.bezierCurveTo(-s, -s*0.5, -s*1.5, s*0.5, 0, s*1.2);
      ctx.bezierCurveTo( s*1.5, s*0.5,  s, -s*0.5, 0, s*0.3);
      ctx.fill();
    }
    ctx.restore();
  }
}

function spawnParticles(n = 14) {
  const cx = flowerCanvas.width/2, cy = flowerCanvas.height/2;
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, r = Math.random()*90;
    particles.push(new Particle(cx+Math.cos(a)*r, cy+Math.sin(a)*r));
  }
}

/* ═══════════════════════════════════════════════
   MEDIAPIPE INIT
   ═══════════════════════════════════════════════ */

const PINCH_CLOSE = 0.045;
const PINCH_OPEN  = 0.20;

function pinchDist(lm) {
  const t = lm[4], i = lm[8];
  return Math.hypot(t.x - i.x, t.y - i.y);
}

async function initMediaPipe() {
  // Check if MediaPipe is available
  if (typeof Hands === 'undefined') {
    setStatus('error', '⚠ MediaPipe unavailable');
    showToast('MediaPipe failed to load — drag the flower manually!', 5000);
    return;
  }

  try {
    const hands = new Hands({
      locateFile: (f) => `https://unpkg.com/@mediapipe/hands/${f}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      // Mirror draw to cam preview
      cc.save();
      cc.scale(-1, 1);
      cc.drawImage(results.image, -camCanvas.width, 0, camCanvas.width, camCanvas.height);
      cc.restore();

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        handDetected = true;

        // Draw skeleton on preview
        if (typeof drawConnectors !== 'undefined') {
          drawConnectors(cc, lm, HAND_CONNECTIONS, { color: 'rgba(168,85,247,0.7)', lineWidth: 2 });
          drawLandmarks(cc, lm, { color: '#ff6fa8', lineWidth: 1, radius: 3 });
        }

        const dist = pinchDist(lm);
        targetBloom = Math.max(0, Math.min(1, (dist - PINCH_CLOSE) / (PINCH_OPEN - PINCH_CLOSE)));

        if (targetBloom > 0.8) {
          setStatus('blooming', 'Blooming! 🌸');
        } else if (targetBloom < 0.15) {
          setStatus('ready', 'Pinching 🤏');
        } else {
          setStatus('ready', 'Hand detected ✋');
        }
        dismissOverlay();
      } else {
        handDetected = false;
        targetBloom  = Math.max(0, targetBloom - 0.01);
        setStatus('ready', 'Show your hand ✋');
      }
    });

    // Get camera stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    videoEl.srcObject = stream;
    await videoEl.play();

    camPreview.classList.add('visible');
    setStatus('ready', 'Show your hand ✋');
    mediapipeReady = true;

    // Process frames
    const cam = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: videoEl });
      },
      width: 640,
      height: 480,
    });
    await cam.start();

  } catch (err) {
    console.error('MediaPipe/Camera error:', err);
    if (err.name === 'NotAllowedError') {
      setStatus('error', '⚠ Camera denied');
      showToast('Camera access denied. Drag the flower to bloom it!', 5000);
    } else {
      setStatus('error', '⚠ Camera error');
      showToast('Camera unavailable. Drag the flower to bloom it!', 5000);
    }
  }
}

/* ═══════════════════════════════════════════════
   START BUTTON
   ═══════════════════════════════════════════════ */

startBtn.addEventListener('click', () => {
  dismissOverlay();
  initMediaPipe();
  setStatus('', 'Initializing camera…');
});

/* ═══════════════════════════════════════════════
   ANIMATION LOOP
   ═══════════════════════════════════════════════ */

function loop() {
  requestAnimationFrame(loop);
  frameCount++;

  // Smooth bloom
  bloomAmount += (targetBloom - bloomAmount) * 0.07;

  // Meter UI
  const pct = Math.round(bloomAmount * 100);
  bloomFill.style.width  = pct + '%';
  bloomValue.textContent = pct + '%';

  // Celebrate at full bloom
  if (bloomAmount > 0.88 && prevBloomSnap < 0.88) {
    spawnParticles(25);
    celebrating    = true;
    celebrateTimer = 0;
    showToast('🌸 Fully Bloomed!', 2500);
  }
  if (celebrating && bloomAmount > 0.75) {
    celebrateTimer++;
    if (celebrateTimer % 7 === 0) spawnParticles(5);
    if (celebrateTimer > 280) celebrating = false;
  } else if (bloomAmount < 0.5) {
    celebrating = false;
  }
  prevBloomSnap = bloomAmount;

  // ── Clear & draw flower ──
  fc.clearRect(0, 0, flowerCanvas.width, flowerCanvas.height);
  drawFlower(bloomAmount);

  // ── Particles ──
  sc.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.update(); p.draw(sc); }
}

loop(); // Start immediately — flower visible right away

/* ═══════════════════════════════════════════════
   MOUSE / TOUCH FALLBACK
   ═══════════════════════════════════════════════ */

let mouseDown = false, mouseX0 = 0, bloomX0 = 0;

flowerCanvas.addEventListener('mousedown', (e) => {
  if (handDetected) return;
  mouseDown = true; mouseX0 = e.clientX; bloomX0 = targetBloom;
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!mouseDown || handDetected) return;
  const delta = (e.clientX - mouseX0) / window.innerWidth;
  targetBloom = Math.max(0, Math.min(1, bloomX0 + delta * 1.6));
});

let t0dist = null;
flowerCanvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    t0dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }
}, { passive: true });
flowerCanvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && t0dist !== null && !handDetected) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    targetBloom = Math.max(0, Math.min(1, d / 350));
  }
}, { passive: true });
