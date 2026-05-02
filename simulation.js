class Particle {
    constructor(canvas, tumor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tumor = tumor;
        this.reset();
    }

    reset() {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { // Top
            this.x = Math.random() * this.canvas.width;
            this.y = -20;
        } else if (side === 1) { // Right
            this.x = this.canvas.width + 20;
            this.y = Math.random() * this.canvas.height;
        } else if (side === 2) { // Bottom
            this.x = Math.random() * this.canvas.width;
            this.y = this.canvas.height + 20;
        } else { // Left
            this.x = -20;
            this.y = Math.random() * this.canvas.height;
        }

        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        
        this.z = Math.random(); 
        this.radius = (1 + this.z * 3);
        this.opacity = 0.3 + this.z * 0.7;
        
        this.color = '#00d2ff';
        this.hasDrug = true;
        this.drugReleasedInside = 0;
        this.drugReleasedOutside = 0;
        this.isInsideTumor = false;
        this.reachedTumor = false;
        this.releaseRate = 0.05;
        this.trail = [];
    }

    update(mode, stainingCtx) {
        const dx = this.tumor.x - this.x;
        const dy = this.tumor.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.tumor.radius * 1.2) {
            const pressureForce = 0.02 * (1 - dist / (this.tumor.radius * 1.2));
            this.vx -= (dx / dist) * pressureForce;
            this.vy -= (dy / dist) * pressureForce;
        }

        if (mode === 'guided') {
            const force = 0.08;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 2.5 + this.z;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            this.releaseDrug('guided', stainingCtx);
        } else {
            this.vx += (Math.random() - 0.5) * 1.2;
            this.vy += (Math.random() - 0.5) * 1.2;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 3 + this.z;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            this.releaseDrug('random', stainingCtx);
        }

        this.x += this.vx;
        this.y += this.vy;

        this.isInsideTumor = this.tumor.contains(this.x, this.y);
        if (this.isInsideTumor) this.reachedTumor = true;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 12) this.trail.shift();

        if (this.x < -100 || this.x > this.canvas.width + 100 || 
            this.y < -100 || this.y > this.canvas.height + 100) {
            this.reset();
        }
    }

    releaseDrug(mode, stainingCtx) {
        if (!this.hasDrug) return;

        let shouldRelease = false;
        if (mode === 'guided') {
            const dx = this.tumor.x - this.x;
            const dy = this.tumor.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.tumor.radius + 30) shouldRelease = true;
        } else {
            shouldRelease = true;
        }

        if (shouldRelease) {
            const amount = this.releaseRate;
            if (this.isInsideTumor) {
                this.drugReleasedInside += amount;
            } else {
                this.drugReleasedOutside += amount;
            }
            this.color = '#00ff88'; 

            if (stainingCtx) {
                stainingCtx.beginPath();
                stainingCtx.arc(this.x, this.y, 4 + this.z * 4, 0, Math.PI * 2);
                stainingCtx.fillStyle = this.isInsideTumor ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255, 77, 77, 0.02)';
                stainingCtx.fill();
            }
        }
    }

    draw() {
        this.ctx.globalCompositeOperation = 'lighter';
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.isInsideTumor ? `rgba(0, 255, 136, ${0.1 * this.z})` : `rgba(0, 210, 255, ${0.05 * this.z})`;
        this.ctx.lineWidth = 1 + this.z;
        for (let i = 0; i < this.trail.length - 1; i++) {
            this.ctx.moveTo(this.trail[i].x, this.trail[i].y);
            this.ctx.lineTo(this.trail[i+1].x, this.trail[i+1].y);
        }
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        const glow = this.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
        const baseColor = this.isInsideTumor ? '0, 255, 136' : (this.color === '#00ff88' ? '0, 255, 136' : '0, 210, 255');
        glow.addColorStop(0, `rgba(${baseColor}, ${this.opacity})`);
        glow.addColorStop(1, `rgba(${baseColor}, 0)`);
        
        this.ctx.fillStyle = glow;
        this.ctx.fill();
        
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${baseColor}, ${this.opacity})`;
        this.ctx.fill();

        this.ctx.globalCompositeOperation = 'source-over';
        this.color = '#00d2ff';
    }
}

class OrganicTumor {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vertices = [];
        this.vertexCount = 36;
        this.noiseOffsets = [];
        this.time = 0;

        for (let i = 0; i < this.vertexCount; i++) {
            this.noiseOffsets.push(Math.random() * Math.PI * 2);
        }
    }

    update() {
        this.time += 0.01;
        this.vertices = [];
        for (let i = 0; i < this.vertexCount; i++) {
            const angle = (i / this.vertexCount) * Math.PI * 2;
            const noise = Math.sin(angle * 3 + this.time + this.noiseOffsets[i]) * 8 + 
                          Math.cos(angle * 5 - this.time * 0.5) * 5;
            const r = this.radius + noise;
            this.vertices.push({
                x: this.x + Math.cos(angle) * r,
                y: this.y + Math.sin(angle) * r
            });
        }
    }

    contains(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
        const vertexIndex = Math.floor(normalizedAngle * this.vertexCount) % this.vertexCount;
        const v = this.vertices[vertexIndex];
        const vDist = Math.sqrt(Math.pow(v.x - this.x, 2) + Math.pow(v.y - this.y, 2));
        return dist < vDist;
    }

    draw(ctx) {
        const glow = ctx.createRadialGradient(this.x, this.y, this.radius * 0.5, this.x, this.y, this.radius * 2);
        glow.addColorStop(0, 'rgba(255, 77, 77, 0.15)');
        glow.addColorStop(1, 'rgba(255, 77, 77, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = 'rgba(255, 77, 77, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 77, 77, 0.08)';
        ctx.fill();

        ctx.save();
        ctx.clip();
        for (let i = 0; i < 5; i++) {
            const ox = Math.sin(this.time + i) * 20;
            const oy = Math.cos(this.time * 0.8 + i) * 15;
            ctx.beginPath();
            ctx.arc(this.x + ox, this.y + oy, 30, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 77, 77, 0.05)';
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
        
        this.particles = [];
        this.particleCount = 120;
        this.tumor = new OrganicTumor(0, 0, 80);
        this.isRunning = false;
        this.isMacroView = true;
        this.mode = 'guided';
        
        this.metrics = {
            efficiency: 0,
            offTarget: 0,
            reachedTumor: 0,
            totalDrugInside: 0,
            totalDrugOutside: 0
        };

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        const startBtn = document.getElementById('start-btn');
        const resetBtn = document.getElementById('reset-btn');
        const container = document.getElementById('canvas-container');
        const macroView = document.getElementById('macro-view');
        const microView = document.getElementById('micro-view');

        startBtn.addEventListener('click', () => {
            if (this.isMacroView) {
                // Trigger Zoom Animation
                container.classList.add('zooming-in');
                startBtn.disabled = true;
                
                setTimeout(() => {
                    this.isMacroView = false;
                    macroView.classList.remove('active');
                    microView.classList.add('active');
                    container.classList.remove('zooming-in');
                    
                    this.isRunning = true;
                    startBtn.disabled = false;
                    startBtn.textContent = 'Pause Simulation';
                    document.getElementById('system-status').textContent = 'Active';
                }, 1200);
            } else {
                this.isRunning = !this.isRunning;
                startBtn.textContent = this.isRunning ? 'Pause Simulation' : 'Resume Simulation';
                document.getElementById('system-status').textContent = this.isRunning ? 'Active' : 'Paused';
            }
        });

        resetBtn.addEventListener('click', () => this.resetToMacro());

        const modeRandomBtn = document.getElementById('mode-random');
        const modeGuidedBtn = document.getElementById('mode-guided');

        this.setMode = (mode) => {
            this.mode = mode;
            modeRandomBtn.classList.toggle('active', mode === 'random');
            modeGuidedBtn.classList.toggle('active', mode === 'guided');
            document.getElementById('current-mode-display').textContent = 
                this.mode === 'guided' ? 'Guided + Triggered' : 'Random Delivery';
            this.reset();
        };

        modeRandomBtn.addEventListener('click', () => this.setMode('random'));
        modeGuidedBtn.addEventListener('click', () => this.setMode('guided'));

        window.sim = this;

        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new Particle(this.canvas, this.tumor));
        }

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
        
        const label = document.getElementById('label-tumor');
        label.style.left = `${this.tumor.x}px`;
        label.style.top = `${this.tumor.y + this.tumor.radius + 20}px`;
    }

    reset() {
        this.particles.forEach(p => p.reset());
        this.stainCtx.clearRect(0, 0, this.stainCanvas.width, this.stainCanvas.height);
        this.metrics = {
            efficiency: 0,
            offTarget: 0,
            reachedTumor: 0,
            totalDrugInside: 0,
            totalDrugOutside: 0
        };
        this.updateMetricsUI();
    }

    resetToMacro() {
        this.isRunning = false;
        this.isMacroView = true;
        this.reset();
        
        const startBtn = document.getElementById('start-btn');
        const macroView = document.getElementById('macro-view');
        const microView = document.getElementById('micro-view');
        
        startBtn.textContent = 'Start Simulation';
        document.getElementById('system-status').textContent = 'Idle';
        
        microView.classList.remove('active');
        macroView.classList.add('active');
    }

    updateMetrics() {
        let inside = 0, outside = 0, reached = 0;
        this.particles.forEach(p => {
            inside += p.drugReleasedInside;
            outside += p.drugReleasedOutside;
            if (p.reachedTumor) reached++;
        });

        this.metrics.totalDrugInside = inside;
        this.metrics.totalDrugOutside = outside;
        this.metrics.reachedTumor = reached;
        
        const total = inside + outside;
        this.metrics.efficiency = total > 0 ? (inside / total) * 100 : 0;
        this.metrics.offTarget = outside;

        this.updateMetricsUI();
    }

    updateMetricsUI() {
        document.getElementById('efficiency').textContent = `${this.metrics.efficiency.toFixed(1)}%`;
        document.getElementById('efficiency-bar').style.width = `${this.metrics.efficiency}%`;
        document.getElementById('off-target').textContent = this.metrics.offTarget.toFixed(1);
        document.getElementById('particles-count').textContent = this.metrics.reachedTumor;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.isMacroView) {
            this.ctx.globalAlpha = 0.6;
            this.ctx.drawImage(this.stainCanvas, 0, 0);
            this.ctx.globalAlpha = 1.0;

            this.tumor.update();
            this.tumor.draw(this.ctx);

            if (this.isRunning) {
                this.particles.forEach(p => p.update(this.mode, this.stainCtx));
                this.updateMetrics();
            }

            this.particles.sort((a, b) => a.z - b.z);
            this.particles.forEach(p => p.draw());
        }

        requestAnimationFrame(() => this.animate());
    }
}

window.onload = () => {
    new Simulation();
};
