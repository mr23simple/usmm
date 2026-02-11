const socket = io();

const container = document.querySelector('.cyber-container');
const nodesLayer = document.getElementById('nodes-layer');
const coreHub = document.getElementById('core-hub');
const hubStatus = document.getElementById('hub-status');
const canvas = document.getElementById('lily-canvas');
const ctx = canvas.getContext('2d');

let width, height;
const pageNodes = new Map(); // pageId -> { el, pistil, color }
const activeOrbs = new Map(); // requestId -> SpiritOrb
const processingPages = new Set(); 
const particles = [];
const backgroundPistils = [];
const allPistils = [];

const CONFIG = {
    stamenCount: 100,
    stamenColor: 'rgba(255, 40, 40, 0.4)', 
    antherColor: 'rgba(255, 200, 200, 0.8)', 
    stemColor: 'rgba(100, 20, 20, 0.6)',
    orbColor: 'rgba(200, 230, 255, 1)',
    orbGlow: 'rgba(100, 180, 255, 0.5)'
};

// --- Utils ---
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function getBezierPoint(t, p0, p1, p2, p3) {
    const oneMinusT = 1 - t;
    const tSq = t * t;
    const tCu = t * t * t;
    const oneMinusTSq = oneMinusT * oneMinusT;
    const oneMinusTCu = oneMinusTSq * oneMinusT;
    const x = oneMinusTCu * p0.x + 3 * oneMinusTSq * t * p1.x + 3 * oneMinusT * tSq * p2.x + tCu * p3.x;
    const y = oneMinusTCu * p0.y + 3 * oneMinusTSq * t * p1.y + 3 * oneMinusT * tSq * p2.y + tCu * p3.y;
    return { x, y };
}

// --- Classes ---

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.life = 1.0;
        this.decay = 0.003 + Math.random() * 0.007; // Slower decay
        this.vx = (Math.random() - 0.5) * 1.2; // Gentler side spread
        this.vy = -0.4 - Math.random() * 0.8; // Slower upward drift
    }
    update() { 
        this.x += this.vx; 
        this.y += this.vy; 
        this.vx *= 0.99; // Air resistance
        this.vy *= 0.99;
        this.life -= this.decay; 
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Pistil {
    constructor(baseAngle, index) {
        this.baseAngle = baseAngle;
        this.index = index;
        this.isGone = false;
        this.isTargeted = false;
        this.respawnTime = 0;
        this.startDelay = index * 20; 
        this.growthDuration = 1000 + Math.random() * 500;
        this.lengthVariance = 0.7 + Math.random() * 0.4; 
        this.swaySpeed = 0.0005 + Math.random() * 0.001; 
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swayRange = 0.06 + Math.random() * 0.04; 
        this.claimedBy = null; // pageId
        this.color = null;
    }

    getGeometry(startX, startY, baseScale, timeSinceStart) {
        const life = timeSinceStart - this.startDelay;
        if (life < 0) return null;
        let progress = Math.min(1, life / this.growthDuration);
        const eased = easeOutCubic(progress);
        const sway = Math.sin(timeSinceStart * this.swaySpeed + this.swayPhase) * this.swayRange * eased;
        const currentAngle = this.baseAngle + sway;
        const currentLen = baseScale * 1.5 * this.lengthVariance * eased;
        const tipX = startX + (Math.cos(currentAngle) * currentLen);
        const tipY = startY + (Math.sin(currentAngle) * currentLen * 0.9); 
        const cp1X = startX + (tipX - startX) * 0.5;
        const cp1Y = startY + (tipY - startY) * 0.1; 
        const curlSharpness = currentLen * 0.4;
        const cp2X = tipX; 
        const cp2Y = tipY + curlSharpness; 
        return { p0: { x: startX, y: startY }, p1: { x: cp1X, y: cp1Y }, p2: { x: cp2X, y: cp2Y }, p3: { x: tipX, y: tipY }, progress, eased };
    }

    draw(startX, startY, baseScale, timeSinceStart) {
        if (this.isGone) return;
        const geom = this.getGeometry(startX, startY, baseScale, timeSinceStart);
        if (!geom) return;

        ctx.beginPath();
        ctx.moveTo(geom.p0.x, geom.p0.y);
        ctx.bezierCurveTo(geom.p1.x, geom.p1.y, geom.p2.x, geom.p2.y, geom.p3.x, geom.p3.y);
        
        const color = this.color || CONFIG.stamenColor;
        const grad = ctx.createLinearGradient(geom.p0.x, geom.p0.y, geom.p3.x, geom.p3.y);
        grad.addColorStop(0, '#300000');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, this.color ? '#ffffff' : '#ffaaaa');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = this.color ? 1.5 : 1.0; 
        ctx.stroke();

        if (geom.progress > 0.1) {
            const circleSize = (this.color ? 3.5 : 2.5) * geom.eased;
            ctx.beginPath();
            ctx.arc(geom.p3.x, geom.p3.y, circleSize, 0, Math.PI * 2);
            ctx.fillStyle = this.color || CONFIG.antherColor;
            if (this.color) {
              ctx.shadowBlur = 10;
              ctx.shadowColor = this.color;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

class SpiritOrb {
    constructor(requestId, targetPistil, color, profilePic) {
        this.requestId = requestId;
        this.targetPistil = targetPistil;
        this.color = color;
        this.profilePic = profilePic;
        this.state = 'WAITING'; 
        this.x = 0; this.y = 0;
        this.radius = 3; 
        this.timer = 0;
        this.finished = false;
        this.waitDuration = 200;
        this.stemDuration = 2000; // Even slower stem travel
        this.pistilDuration = 5000; // Dramatic 5-second travel along the pistil
        
        if (profilePic) {
            this.img = new Image();
            this.img.src = profilePic;
        }
    }

    update(startX, startY, stemHeight, baseScale, timeSinceStart) {
        if (this.state === 'WAITING') {
            this.timer += 16;
            this.x = startX; this.y = startY + stemHeight;
            if (this.timer > this.waitDuration) { this.state = 'STEM'; this.timer = 0; }
        } else if (this.state === 'STEM') {
            this.timer += 16;
            const t = Math.min(1, this.timer / this.stemDuration);
            this.x = startX; this.y = (startY + stemHeight) - (stemHeight * t);
            if (t >= 1) { this.state = 'PISTIL'; this.timer = 0; }
        } else if (this.state === 'PISTIL') {
            this.timer += 16;
            const t = Math.min(1, this.timer / this.pistilDuration);
            const easedT = easeInOutQuad(t);
            const geom = this.targetPistil.getGeometry(startX, startY, baseScale, timeSinceStart);
            if (geom) {
                const pos = getBezierPoint(easedT, geom.p0, geom.p1, geom.p2, geom.p3);
                this.x = pos.x; this.y = pos.y;
            }
            if (t >= 1) { 
              this.state = 'FLOAT'; this.timer = 0; 
              shatterPistil(this.targetPistil, startX, startY, baseScale, timeSinceStart);
            }
        } else if (this.state === 'FLOAT') {
            this.timer += 16;
            this.y -= 0.6; // Much slower float speed
            if (this.radius < 10) this.radius += 0.1; // Smaller max size
            if (this.y < -100) this.finished = true;
        }
    }

    draw(ctx) {
        ctx.save();
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        const glowRadius = this.radius * (this.state === 'FLOAT' ? 2 : 4) * pulse;
        
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.4, this.color + '80');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2); 
        ctx.fill();

        if (this.state === 'FLOAT' && this.img && this.img.complete && this.img.naturalWidth !== 0) {
            // Draw logo inside the orb
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.img, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath(); 
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); 
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// --- Functions ---

function shatterPistil(pistil, startX, startY, baseScale, time) {
    pistil.isGone = true;
    pistil.respawnTime = time + 6000; // Stay shattered longer (6 seconds)
    const geom = pistil.getGeometry(startX, startY, baseScale, time);
    if (!geom) return;
    // Dramatic increase in particle count
    for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const pos = getBezierPoint(t, geom.p0, geom.p1, geom.p2, geom.p3);
        particles.push(new Particle(pos.x, pos.y, pistil.color || CONFIG.stamenColor));
    }
}

function initLily() {
    allPistils.length = 0;
    const startAngle = -Math.PI * 0.95; 
    const endAngle = -Math.PI * 0.05;   
    for (let i = 0; i < CONFIG.stamenCount; i++) {
        const t = i / (CONFIG.stamenCount - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        allPistils.push(new Pistil(angle, i));
    }
}

function resize() {
    width = canvas.width = container.clientWidth;
    height = canvas.height = container.clientHeight;
    initLily();
}

function getColorForPage(pageId) {
  const NEON_COLORS = ['#ff007f', '#ffff00', '#00f3ff', '#00ff00', '#ff00ff', '#ff4d00', '#bc00ff', '#00ffa3'];
  let hash = 0;
  for (let i = 0; i < pageId.length; i++) hash = pageId.charCodeAt(i) + ((hash << 5) - hash);
  return NEON_COLORS[Math.abs(hash) % NEON_COLORS.length];
}

async function handleUpdate(data) {
    const { platform, pageId, status, isDryRun, requestId, profilePic } = data;
    const neonRed = '#ff2828'; // Consistent Lily Red

    if (!pageNodes.has(pageId)) {
        const unclaimed = allPistils.filter(p => !p.claimedBy);
        if (unclaimed.length === 0) return; // Global limit: 100 concurrent project nodes
        
        const targetPistil = unclaimed[Math.floor(Math.random() * unclaimed.length)];
        targetPistil.claimedBy = pageId;
        targetPistil.color = neonRed;
        
        pageNodes.set(pageId, { pistil: targetPistil, color: neonRed, profilePic });
    }

    const node = pageNodes.get(pageId);
    if (status === 'queued') {
        if (activeOrbs.size >= 100) return; // Global limit: 100 concurrent spirit orbs
        const orb = new SpiritOrb(requestId, node.pistil, neonRed, profilePic);
        activeOrbs.set(requestId, orb);
    } else if (status === 'processing') {
        processingPages.add(pageId);
        coreHub.classList.add('active-core');
        coreHub.style.setProperty('filter', `drop-shadow(0 0 25px ${neonRed})`, 'important');
        hubStatus.textContent = `SYNCING: ${pageId.slice(0,8)}`;
        hubStatus.style.color = neonRed;
    } else if (status === 'completed' || status === 'failed') {
        processingPages.delete(pageId);
        if (processingPages.size === 0) {
            coreHub.classList.remove('active-core');
            coreHub.style.filter = '';
            hubStatus.textContent = 'READY';
            hubStatus.style.color = '';
        }
    }
}

function animate(currentTime) {
    ctx.clearRect(0, 0, width, height);
    const timeSinceStart = currentTime;
    const startX = width / 2;
    const startY = height * 0.8; 
    const stemHeight = height - startY;
    const baseScale = Math.min(width, height) * 0.35;

    // Stem
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, height);
    ctx.strokeStyle = CONFIG.stemColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Core Bulb
    ctx.beginPath();
    ctx.arc(startX, startY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#400000';
    ctx.fill();

    // Regeneration
    allPistils.forEach(p => {
        if (p.isGone && timeSinceStart > p.respawnTime) {
            p.isGone = false;
            p.startDelay = timeSinceStart;
            p.color = null; // Reset to default color
            p.claimedBy = null; // Make available again
        }
        p.draw(startX, startY, baseScale, timeSinceStart);
    });

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Orbs
    for (const [id, orb] of activeOrbs.entries()) {
        orb.update(startX, startY, stemHeight, baseScale, timeSinceStart);
        orb.draw(ctx);
        if (orb.finished) activeOrbs.delete(id);
    }

    requestAnimationFrame(animate);
}

socket.on('queue_update', handleUpdate);
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(animate);
