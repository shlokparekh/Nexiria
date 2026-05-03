class Telemetry {
    constructor() {
        this.el = document.getElementById('console-log');
    }

    log(message) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
        entry.textContent = `[${timestamp}] ${message}`;
        this.el.prepend(entry);
        
        // Keep only last 50 entries
        if (this.el.children.length > 50) {
            this.el.removeChild(this.el.lastChild);
        }
    }
}

class Graph {
    constructor(canvasId, color) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.color = color;
        this.data = [];
        this.maxDataPoints = 100;
        this.resize();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = 80;
    }

    addPoint(val) {
        this.data.push(val);
        if (this.data.length > this.maxDataPoints) this.data.shift();
        this.draw();
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        // Draw Grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const y = (height / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Draw Line
        if (this.data.length < 2) return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = 2;
        
        const max = Math.max(...this.data, 1);
        const step = width / (this.maxDataPoints - 1);

        this.ctx.moveTo(0, height - (this.data[0] / max) * height);
        for (let i = 1; i < this.data.length; i++) {
            this.ctx.lineTo(i * step, height - (this.data[i] / max) * height);
        }
        this.ctx.stroke();

        // Area fill
        this.ctx.lineTo((this.data.length - 1) * step, height);
        this.ctx.lineTo(0, height);
        this.ctx.fillStyle = this.color.replace('1)', '0.1)');
        this.ctx.fill();
    }
}

class Particle {
    constructor(canvas, tumor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tumor = tumor;
        this.reset();
    }

    reset() {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = Math.random() * this.canvas.width; this.y = -20; }
        else if (side === 1) { this.x = this.canvas.width + 20; this.y = Math.random() * this.canvas.height; }
        else if (side === 2) { this.x = Math.random() * this.canvas.width; this.y = this.canvas.height + 20; }
        else { this.x = -20; this.y = Math.random() * this.canvas.height; }

        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.z = Math.random(); 
        this.radius = 1.5 + this.z * 2.5;
        this.opacity = 0.4 + this.z * 0.6;
        this.hasDrug = true;
        this.drugReleasedInside = 0;
        this.drugReleasedOutside = 0;
        this.isInsideTumor = false;
        this.reachedTumor = false;
        this.releaseRate = 0.05;
        this.zetaImpact = 1.0; // Influenced by slider
        this.ligandImpact = 1.0; // Influenced by slider
        this.trail = [];
    }

    update(mode, stainingCtx, telemetry, zeta, ligand) {
        this.zetaImpact = zeta;
        this.ligandImpact = ligand;
        
        const dx = this.tumor.x - this.x;
        const dy = this.tumor.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Resistance force from dense tumor core
        if (dist < this.tumor.radius * 1.5) {
            const pressure = 0.03 * (1 - dist / (this.tumor.radius * 1.5));
            this.vx -= (dx / dist) * pressure;
            this.vy -= (dy / dist) * pressure;
        }

        if (mode === 'guided') {
            const force = 0.05 + (0.1 * this.ligandImpact); // Ligand Density increases steering force
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
            const maxSpeed = 2.0 + this.z + (1.0 * this.ligandImpact);
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > maxSpeed) { this.vx = (this.vx / speed) * maxSpeed; this.vy = (this.vy / speed) * maxSpeed; }
            this.releaseDrug('guided', stainingCtx, telemetry);
        } else {
            this.vx += (Math.random() - 0.5) * 1.5;
            this.vy += (Math.random() - 0.5) * 1.5;
            const maxSpeed = 3.5 + this.z;
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > maxSpeed) { this.vx = (this.vx / speed) * maxSpeed; this.vy = (this.vy / speed) * maxSpeed; }
            this.releaseDrug('random', stainingCtx, telemetry);
        }

        this.x += this.vx;
        this.y += this.vy;
        this.isInsideTumor = this.tumor.contains(this.x, this.y);
        
        if (this.isInsideTumor && !this.reachedTumor) {
            this.reachedTumor = true;
            if (telemetry) telemetry.log("Particle targeted cellular uptake confirmed.");
        }

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.shift();

        if (this.x < -100 || this.x > this.canvas.width + 100 || this.y < -100 || this.y > this.canvas.height + 100) {
            this.reset();
        }
    }

    releaseDrug(mode, stainingCtx, telemetry) {
        if (!this.hasDrug) return;
        let shouldRelease = (mode === 'guided') ? (Math.sqrt(Math.pow(this.tumor.x-this.x,2)+Math.pow(this.tumor.y-this.y,2)) < this.tumor.radius + 30) : true;

        if (shouldRelease) {
            const effectiveRate = this.releaseRate * (0.5 + this.zetaImpact); // Zeta Potential increases release reactivity
            if (this.isInsideTumor) this.drugReleasedInside += effectiveRate;
            else this.drugReleasedOutside += effectiveRate;

            if (stainingCtx) {
                stainingCtx.beginPath();
                stainingCtx.arc(this.x, this.y, 5 + this.z * 5, 0, Math.PI * 2);
                stainingCtx.fillStyle = this.isInsideTumor ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 77, 77, 0.015)';
                stainingCtx.fill();
            }
        }
    }

    draw() {
        this.ctx.globalCompositeOperation = 'lighter';
        const baseColor = this.isInsideTumor ? '0, 255, 136' : '0, 210, 255';
        
        // Particle core
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        const glow = this.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2.5);
        glow.addColorStop(0, `rgba(${baseColor}, ${this.opacity})`);
        glow.addColorStop(1, `rgba(${baseColor}, 0)`);
        this.ctx.fillStyle = glow;
        this.ctx.fill();

        this.ctx.globalCompositeOperation = 'source-over';
    }
}

class OrganicTumor {
    constructor(x, y, radius) {
        this.x = x; this.y = y; this.radius = radius;
        this.vertices = []; this.vertexCount = 48;
        this.time = 0;
    }

    update() {
        this.time += 0.015;
        this.vertices = [];
        for (let i = 0; i < this.vertexCount; i++) {
            const angle = (i / this.vertexCount) * Math.PI * 2;
            const noise = Math.sin(angle * 4 + this.time) * 10 + Math.cos(angle * 6 - this.time * 0.7) * 6;
            const r = this.radius + noise;
            this.vertices.push({ x: this.x + Math.cos(angle) * r, y: this.y + Math.sin(angle) * r });
        }
    }

    contains(px, py) {
        const dx = px - this.x, dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
        const vertexIndex = Math.floor(normalizedAngle * this.vertexCount) % this.vertexCount;
        const v = this.vertices[vertexIndex];
        const vDist = Math.sqrt(Math.pow(v.x - this.x, 2) + Math.pow(v.y - this.y, 2));
        return dist < vDist;
    }

    draw(ctx) {
        // MRI-style high contrast mask
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        const glow = ctx.createRadialGradient(this.x, this.y, this.radius * 0.4, this.x, this.y, this.radius * 1.8);
        glow.addColorStop(0, 'rgba(40, 40, 50, 0.4)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fill();

        // Main tumor body with MRI tissue texture
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        ctx.closePath();
        
        // Grainy tissue fill
        ctx.fillStyle = 'rgba(255, 77, 77, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Internal tissue structures (MRI noise)
        ctx.clip();
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 8; i++) {
            const ox = Math.sin(this.time * 0.5 + i) * 30;
            const oy = Math.cos(this.time * 0.3 + i) * 20;
            ctx.beginPath();
            ctx.ellipse(this.x + ox, this.y + oy, 40, 25, Math.PI/4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
        }
        ctx.restore();
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('sim-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stainCanvas = document.createElement('canvas');
        this.stainCtx = this.stainCanvas.getContext('2d');
        
        this.telemetry = new Telemetry();
        this.graphConcentration = new Graph('chart-concentration', 'rgba(0, 255, 136, 1)');
        this.graphPH = new Graph('chart-ph', 'rgba(0, 210, 255, 1)');
        
        this.particles = [];
        this.particleCount = 150;
        this.tumor = new OrganicTumor(0, 0, 85);
        this.isRunning = false;
        this.isMacroView = true;
        this.mode = 'guided';
        
        this.params = {
            zeta: 0.7,
            ligand: 0.85
        };
        
        this.metrics = { efficiency: 0, offTarget: 0, reachedTumor: 0, totalInside: 0, totalOutside: 0 };
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.graphConcentration.resize(); this.graphPH.resize(); });

        const startBtn = document.getElementById('start-btn');
        const resetBtn = document.getElementById('reset-btn');
        const container = document.getElementById('canvas-container');

        startBtn.addEventListener('click', () => {
            if (this.isMacroView) {
                // Phase 1: Start Zoom
                container.classList.add('zooming-in');
                startBtn.disabled = true;
                this.telemetry.log("Zoom sequence initiated. Target: Thoracic Zone A.");
                
                // Switch states immediately for rendering
                this.isMacroView = false;
                
                setTimeout(() => {
                    // Phase 2: Finalize Transition
                    document.getElementById('macro-view').classList.remove('active');
                    document.getElementById('micro-view').classList.add('active');
                    container.classList.remove('zooming-in');
                    this.isRunning = true;
                    startBtn.disabled = false;
                    startBtn.textContent = 'PAUSE PROTOCOL';
                    this.telemetry.log("Microscopic deployment successful. Particles online.");
                }, 1200);
            } else {
                this.isRunning = !this.isRunning;
                startBtn.textContent = this.isRunning ? 'PAUSE PROTOCOL' : 'RESUME PROTOCOL';
                this.telemetry.log(this.isRunning ? "Protocol resumed." : "Protocol paused by user.");
            }
        });

        resetBtn.addEventListener('click', () => {
            this.isRunning = false; this.isMacroView = true;
            this.reset();
            startBtn.textContent = 'INITIALIZE SEQUENCE';
            document.getElementById('micro-view').classList.remove('active');
            document.getElementById('macro-view').classList.add('active');
            this.telemetry.log("System reset complete. All parameters cleared.");
        });

        this.setMode = (mode) => {
            this.mode = mode;
            document.getElementById('mode-random').classList.toggle('active', mode === 'random');
            document.getElementById('mode-guided').classList.toggle('active', mode === 'guided');
            document.getElementById('current-mode-display').textContent = `STRATEGY: ${mode.toUpperCase()} + TRIGGERED`;
            this.telemetry.log(`Strategy switched to ${mode.toUpperCase()}. Re-calculating vectors.`);
            this.reset();
        };

        window.sim = this;

        // Parameter Sliders
        const zetaSlider = document.querySelectorAll('.slider')[0];
        const ligandSlider = document.querySelectorAll('.slider')[1];

        zetaSlider.addEventListener('input', (e) => {
            this.params.zeta = e.target.value / 100;
            this.telemetry.log(`Zeta Potential adjusted to ${e.target.value} mV. Surface charge recalculated.`);
        });

        ligandSlider.addEventListener('input', (e) => {
            this.params.ligand = e.target.value / 100;
            this.telemetry.log(`Ligand Density set to ${e.target.value}%. Targeting sensitivity updated.`);
        });
        for (let i = 0; i < this.particleCount; i++) this.particles.push(new Particle(this.canvas, this.tumor));
        this.animate();
    }

    resize() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.stainCanvas.width = this.canvas.width;
        this.stainCanvas.height = this.canvas.height;
        this.tumor.x = this.canvas.width / 2;
        this.tumor.y = this.canvas.height / 2;
        document.getElementById('label-tumor').style.left = `${this.tumor.x}px`;
        document.getElementById('label-tumor').style.top = `${this.tumor.y + this.tumor.radius + 30}px`;
    }

    reset() {
        this.particles.forEach(p => p.reset());
        this.stainCtx.clearRect(0, 0, this.stainCanvas.width, this.stainCanvas.height);
        this.metrics = { efficiency: 0, offTarget: 0, reachedTumor: 0, totalInside: 0, totalOutside: 0 };
        this.updateMetricsUI();
    }

    updateMetrics() {
        let inside = 0, outside = 0, reached = 0;
        this.particles.forEach(p => {
            inside += p.drugReleasedInside; outside += p.drugReleasedOutside;
            if (p.reachedTumor) reached++;
        });
        this.metrics.totalInside = inside;
        this.metrics.totalOutside = outside;
        this.metrics.reachedTumor = reached;
        const total = inside + outside;
        this.metrics.efficiency = total > 0 ? (inside / total) * 100 : 0;
        this.metrics.offTarget = outside;
        this.updateMetricsUI();
        
        // Update Analytics Graphs
        if (Math.random() > 0.8) { // Sample data periodically
            this.graphConcentration.addPoint(this.metrics.totalInside);
            this.graphPH.addPoint(7.4 - (this.metrics.totalInside / 500)); // Simulated pH drop
        }
    }

    updateMetricsUI() {
        document.getElementById('efficiency').textContent = `${this.metrics.efficiency.toFixed(1)}%`;
        document.getElementById('efficiency-bar').style.width = `${this.metrics.efficiency}%`;
        document.getElementById('off-target').textContent = this.metrics.offTarget.toFixed(1);
        document.getElementById('particles-count').textContent = `${this.metrics.reachedTumor} / ${this.particleCount}`;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.isMacroView) {
            // Draw Targeting Message if still zooming
            const container = document.getElementById('canvas-container');
            if (container.classList.contains('zooming-in')) {
                this.ctx.font = '14px "JetBrains Mono"';
                this.ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText("TARGET ACQUISITION IN PROGRESS...", this.canvas.width / 2, this.canvas.height / 2 + 40);
                this.ctx.textAlign = 'left';
            }

            this.ctx.globalAlpha = 0.5;
            this.ctx.drawImage(this.stainCanvas, 0, 0);
            this.ctx.globalAlpha = 1.0;
            this.tumor.update();
            this.tumor.draw(this.ctx);
            if (this.isRunning) {
                this.particles.forEach(p => p.update(this.mode, this.stainCtx, this.telemetry, this.params.zeta, this.params.ligand));
                this.updateMetrics();
            }
            this.particles.sort((a, b) => a.z - b.z);
            this.particles.forEach(p => p.draw());

            // Add precision HUD data
            this.ctx.font = '8px "JetBrains Mono"';
            this.ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
            this.ctx.fillText(`SCAN_LINE: ${Math.floor(this.tumor.time * 100) % 100}`, 20, 20);
            this.ctx.fillText(`LATENCY: 12ms`, 20, 32);
            this.ctx.fillText(`PH_LEVEL: 6.8`, this.canvas.width - 80, 20);
        }
        requestAnimationFrame(() => this.animate());
    }
}

window.onload = () => { new Simulation(); };
