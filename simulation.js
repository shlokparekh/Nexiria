/**
 * Nexiria Advanced Operating Interface v5.0
 * Cinematic Biotech Control System
 */

class FluidField {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.cellSize = 100;
        this.cols = Math.ceil(w / this.cellSize);
        this.rows = Math.ceil(h / this.cellSize);
        this.field = [];
        this.init();
    }

    init() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const angle = Math.sin(x * 0.5) * 0.2 + Math.cos(y * 0.5) * 0.2;
                this.field.push({ x: 1.5 + Math.cos(angle), y: Math.sin(angle) });
            }
        }
    }

    getVector(x, y) {
        const col = Math.floor(Math.abs(x % this.width) / this.cellSize);
        const row = Math.floor(Math.abs(y % this.height) / this.cellSize);
        const index = row * this.cols + col;
        return this.field[index] || { x: 1, y: 0 };
    }
}

class RedBloodCell {
    constructor(w, h) {
        this.x = Math.random() * 2000 - 1000;
        this.y = Math.random() * 2000 - 1000;
        this.size = 30 + Math.random() * 20;
        this.opacity = 0.08 + Math.random() * 0.05;
        this.speed = 0.3 + Math.random() * 0.4;
    }

    update(field, w, h, cam) {
        const v = field.getVector(this.x, this.y);
        this.x += v.x * this.speed;
        this.y += v.y * this.speed;
        
        if (this.x > cam.x + 1000) this.x = cam.x - 1000;
        if (this.x < cam.x - 1000) this.x = cam.x + 1000;
        if (this.y > cam.y + 1000) this.y = cam.y - 1000;
        if (this.y < cam.y - 1000) this.y = cam.y + 1000;
    }

    draw(ctx, cam) {
        const sx = (this.x - cam.x) * cam.zoom + window.innerWidth / 2;
        const sy = (this.y - cam.y) * cam.zoom + window.innerHeight / 2;
        const sr = this.size * cam.zoom;

        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * 0.7, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 77, 77, ${this.opacity})`;
        ctx.fill();
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1.5; // Boosted zoom
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1.5;
        this.lerpSpeed = 0.08; // Responsive
        this.isLocked = false;
    }

    update() {
        this.x += (this.targetX - this.x) * this.lerpSpeed;
        this.y += (this.targetY - this.y) * this.lerpSpeed;
        this.zoom += (this.targetZoom - this.zoom) * this.lerpSpeed;
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - window.innerWidth / 2) / this.zoom + this.x,
            y: (sy - window.innerHeight / 2) / this.zoom + this.y
        };
    }
}

class ParticleEmitter {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                color
            });
        }
    }

    update() {
        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            p.life -= 0.02;
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(ctx, cam) {
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc((p.x - cam.x) * cam.zoom + window.innerWidth / 2, 
                    (p.y - cam.y) * cam.zoom + window.innerHeight / 2, 
                    2 * cam.zoom, 0, Math.PI * 2); // Increased visibility
            ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
            ctx.fill();
        });
    }
}

class Anomaly {
    constructor(x, y) {
        this.x = x !== undefined ? x : (Math.random() * 400 - 200); // Shrink bounds
        this.y = y !== undefined ? y : (Math.random() * 400 - 200);
        this.radius = 80 + Math.random() * 40;
        this.health = 1.0;
        this.pulse = 0;
        this.markers = { hypoxia: 0, enzyme: 0, metabolic: 0 };
        this.confidence = 0;
        this.isVerified = false;
        this.id = "ANOMALY_" + Math.floor(Math.random() * 9999);
    }

    update() {
        this.pulse += 0.02;
        if (this.markers.hypoxia > 0.9 && this.markers.enzyme > 0.9 && this.markers.metabolic > 0.9) {
            this.confidence += 0.5;
            if (this.confidence >= 100) {
                this.confidence = 100;
                this.isVerified = true;
            }
        }
    }

    draw(ctx, cam) {
        const sx = (this.x - cam.x) * cam.zoom + window.innerWidth / 2;
        const sy = (this.y - cam.y) * cam.zoom + window.innerHeight / 2;
        const sr = this.radius * cam.zoom;

        const pulse = Math.sin(this.pulse) * 8 * cam.zoom;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr + pulse);
        grad.addColorStop(0, `rgba(255, 40, 40, ${0.4 * this.health})`); // Brighter
        grad.addColorStop(0.6, `rgba(255, 100, 100, ${0.1 * this.health})`);
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(sx, sy, sr + pulse, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // High-contrast border
        ctx.beginPath();
        ctx.arc(sx, sy, sr + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 100, 100, ${0.3 * this.health})`;
        ctx.lineWidth = 2 * cam.zoom;
        ctx.stroke();

        // Marker Visualization Panel (Floating)
        if (this.confidence > 5) {
            this.drawDiagnosticPanel(ctx, sx, sy, sr);
        }
    }

    drawDiagnosticPanel(ctx, sx, sy, sr) {
        ctx.font = '10px "JetBrains Mono"';
        ctx.fillStyle = 'rgba(0, 210, 255, 0.7)';
        const px = sx + sr + 20;
        const py = sy - 40;
        
        ctx.fillRect(px, py, 120, 60);
        ctx.fillStyle = '#000';
        ctx.fillText("SCAN_ID: " + this.id, px + 5, py + 15);
        
        this.drawBar(ctx, px + 5, py + 25, "HYPOXIA", this.markers.hypoxia);
        this.drawBar(ctx, px + 5, py + 35, "ENZYME ", this.markers.enzyme);
        this.drawBar(ctx, px + 5, py + 45, "METABOL", this.markers.metabolic);
        
        ctx.fillStyle = this.isVerified ? '#00ff88' : '#ffff64';
        ctx.fillText("CONF: " + this.confidence.toFixed(0) + "%", px + 5, py + 57);
    }

    drawBar(ctx, x, y, label, val) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x + 50, y - 6, 60, 4);
        ctx.fillStyle = val > 0.9 ? '#00ff88' : '#00d2ff';
        ctx.fillRect(x + 50, y - 6, 60 * val, 4);
        ctx.fillStyle = '#000';
        ctx.font = '8px "JetBrains Mono"';
        ctx.fillText(label, x, y);
    }
}

class Nanosystem {
    constructor(cam) {
        this.cam = cam;
        this.reset();
    }

    reset(nearCam = false) {
        if (nearCam && this.cam) {
            this.x = this.cam.x + (Math.random() * 400 - 200);
            this.y = this.cam.y + (Math.random() * 400 - 200);
        } else {
            this.x = Math.random() * 2000 - 1000;
            this.y = Math.random() * 2000 - 1000;
        }
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.state = 'dormant';
        this.target = null;
        this.opacity = 0.8; // High visibility
        this.confidence = 0;
    }

    update(anomalies, strategy) {
        if (strategy === 'passive') {
            this.state = 'dormant';
            this.opacity = 0.3;
        } else {
            // Intelligent Nexiria logic
            if (this.state === 'dormant') {
                anomalies.forEach(a => {
                    const d = Math.hypot(a.x - this.x, a.y - this.y);
                    if (d < 200) {
                        this.state = 'verifying';
                        this.target = a;
                    }
                });
            } else if (this.state === 'verifying') {
                const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
                // Stronger "Signal Lock-On" attraction (v5.2)
                this.vx += (this.target.x - this.x) * 0.015;
                this.vy += (this.target.y - this.y) * 0.015;
                this.vx *= 0.92; this.vy *= 0.92;
                
                // Turbo-Scan Mode (v5.4)
                this.target.markers.hypoxia = Math.min(1, this.target.markers.hypoxia + 0.05);
                this.target.markers.enzyme = Math.min(1, this.target.markers.enzyme + 0.05);
                this.target.markers.metabolic = Math.min(1, this.target.markers.metabolic + 0.05);

                if (this.target.isVerified) this.state = 'active';
                if (d > 300) this.state = 'dormant';
            } else if (this.state === 'active') {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const dist = Math.hypot(dx, dy);
                this.vx = (dx / dist) * 5;
                this.vy = (dy / dist) * 5;
                if (dist < 10) {
                    this.state = 'degrading';
                    this.target.health -= 0.01;
                }
            } else if (this.state === 'degrading') {
                this.opacity -= 0.02;
                if (this.opacity <= 0) this.reset();
            }
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx, cam) {
        const sx = (this.x - cam.x) * cam.zoom + window.innerWidth / 2;
        const sy = (this.y - cam.y) * cam.zoom + window.innerHeight / 2;
        const color = this.state === 'dormant' ? '0, 210, 255' : 
                      this.state === 'verifying' ? '255, 255, 100' :
                      this.state === 'active' ? '0, 255, 136' : '255, 255, 255';

        const nodeSize = (this.state === 'active' ? 5 : 3) * cam.zoom;
        
        ctx.beginPath();
        ctx.arc(sx, sy, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${this.opacity})`;
        ctx.fill();

        // Extra glow for active bots
        if (this.state !== 'dormant') {
            ctx.shadowBlur = 15 * cam.zoom;
            ctx.shadowColor = `rgba(${color}, 1)`;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
}

class BioEngine {
    constructor() {
        this.canvas = document.getElementById('nexiria-viewport');
        this.ctx = this.canvas.getContext('2d');
        this.cam = new Camera();
        this.nodes = [];
        this.anomalies = [];
        this.rbcs = []; // Fixed: Re-initialized
        this.strategy = 'intelligent';
        this.focusMode = true;
        this.emitter = new ParticleEmitter();
        this.degradedCount = 0;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.field = new FluidField(this.canvas.width, this.canvas.height);

        // Populate background environment
        for (let i = 0; i < 40; i++) this.rbcs.push(new RedBloodCell(this.canvas.width, this.canvas.height));
        for (let i = 0; i < 50; i++) this.nodes.push(new Nanosystem(this.cam));
        
        // Auto-spawn first anomaly for immediate feedback
        this.anomalies.push(new Anomaly(0, 0));
        
        // Manual Controls (Improved responsiveness & coordinate handling)
        document.getElementById('btn-spawn').onclick = () => {
            const worldPos = { x: this.cam.x + (Math.random() * 400 - 200), y: this.cam.y + (Math.random() * 400 - 200) };
            this.anomalies.push(new Anomaly(worldPos.x, worldPos.y));
            console.log("Anomaly spawned at", worldPos);
        };
        document.getElementById('btn-inject').onclick = () => { 
            for(let i=0; i<30; i++) {
                const n = new Nanosystem(this.cam);
                n.reset(true); // Spawn near camera
                this.nodes.push(n);
            }
        };
        document.getElementById('btn-mode').onclick = (e) => {
            this.strategy = this.strategy === 'intelligent' ? 'passive' : 'intelligent';
            e.target.textContent = this.strategy === 'intelligent' ? 'TOGGLE_PASSIVE' : 'TOGGLE_NEXIRIA';
            document.getElementById('val-mode').textContent = `STRATEGY: ${this.strategy.toUpperCase()}`;
        };
        document.getElementById('btn-focus').onclick = (e) => {
            this.focusMode = !this.focusMode;
            e.target.classList.toggle('active', this.focusMode);
            e.target.textContent = this.focusMode ? 'AUTO_FOCUS: ON' : 'AUTO_FOCUS: OFF';
            document.body.classList.toggle('focus-active', this.focusMode);
        };
        document.getElementById('close-inspection').onclick = () => document.getElementById('inspection-panel').classList.remove('open');

        // Click detection
        this.canvas.onclick = (e) => {
            const worldPos = this.cam.screenToWorld(e.clientX, e.clientY);
            const hit = this.anomalies.find(a => Math.hypot(a.x - worldPos.x, a.y - worldPos.y) < a.radius);
            if (hit) this.openInspection(hit);
        };

        this.animate();
        this.updateClock();
        
        // Track the currently inspected anomaly
        this.inspectedAnomaly = null;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    openInspection(a) {
        this.inspectedAnomaly = a;
        document.getElementById('inspection-panel').classList.add('open');
        this.updateInspectionPanel();
    }

    updateInspectionPanel() {
        if (!this.inspectedAnomaly) return;
        const a = this.inspectedAnomaly;
        const data = document.getElementById('inspection-data');
        data.innerHTML = `
            <p><span class="m-label">ID</span> ${a.id}</p>
            <p><span class="m-label">COORDS</span> ${a.x.toFixed(0)}, ${a.y.toFixed(0)}</p>
            <p><span class="m-label">HYPOXIA</span> ${(a.markers.hypoxia*100).toFixed(1)}%</p>
            <p><span class="m-label">ENZYME</span> ${(a.markers.enzyme*100).toFixed(1)}%</p>
            <p><span class="m-label">METABOLIC</span> ${(a.markers.metabolic*100).toFixed(1)}%</p>
            <p><span class="m-label">HEALTH</span> ${(a.health*100).toFixed(1)}%</p>
            <p><span class="m-label">STATUS</span> <span style="color: ${a.isVerified?'#00ff88':'#ffff64'}">${a.isVerified?'VERIFIED':'SCANNING'}</span></p>
        `;
    }

    updateClock() {
        document.getElementById('hud-clock').textContent = new Date().toTimeString().split(' ')[0];
        setTimeout(() => this.updateClock(), 1000);
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.cam.update();

        // Focus Logic (Stronger Zoom)
        if (this.focusMode && this.anomalies.length > 0) {
            const target = this.anomalies[0];
            this.cam.targetX = target.x;
            this.cam.targetY = target.y;
            this.cam.targetZoom = 2.5; // Dramatic Zoom
        } else {
            this.cam.targetZoom = 1.0;
        }

        // Draw RBCs (Updated for camera wrap)
        this.rbcs.forEach(c => {
            c.update(this.field, this.canvas.width, this.canvas.height, this.cam);
            c.draw(this.ctx, this.cam);
        });

        this.anomalies = this.anomalies.filter(a => a.health > 0);
        this.anomalies.forEach(a => {
            a.update();
            a.draw(this.ctx, this.cam);
        });

        this.ctx.globalCompositeOperation = 'lighter';
        this.nodes.forEach(n => {
            n.update(this.anomalies, this.strategy);
            n.draw(this.ctx, this.cam);
            if (n.state === 'degrading' && n.opacity > 0.98) {
                this.degradedCount++;
                this.emitter.emit(n.x, n.y, '255, 255, 255', 5);
            }
        });
        this.ctx.globalCompositeOperation = 'source-over';

        this.emitter.update();
        this.emitter.draw(this.ctx, this.cam);

        this.updateHUD();
        this.updateInspectionPanel(); // Keep panel updated in real-time
        requestAnimationFrame(() => this.animate());
    }

    updateHUD() {
        document.getElementById('val-dormant').textContent = this.nodes.filter(n => n.state === 'dormant').length;
        document.getElementById('val-verifying').textContent = this.nodes.filter(n => n.state === 'verifying').length;
        document.getElementById('val-active').textContent = this.nodes.filter(n => n.state === 'active').length;
        document.getElementById('val-degraded').textContent = this.degradedCount;
        
        const verifying = this.nodes.filter(n => n.state === 'verifying').length;
        const sync = Math.min(100, (verifying / 10) * 100);
        document.getElementById('val-sync').textContent = sync.toFixed(1) + "%";

        if (this.anomalies.length > 0) {
            const avgConf = this.anomalies.reduce((acc, a) => acc + a.confidence, 0) / this.anomalies.length;
            document.getElementById('val-confidence').textContent = avgConf.toFixed(1) + "%";
        }
    }
}

window.onload = () => { new BioEngine(); };
