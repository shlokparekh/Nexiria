class Particle {
    constructor(canvas, tumor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tumor = tumor;
        this.reset();
    }

    reset() {
        // Start particles from the edges
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { // Top
            this.x = Math.random() * this.canvas.width;
            this.y = -10;
        } else if (side === 1) { // Right
            this.x = this.canvas.width + 10;
            this.y = Math.random() * this.canvas.height;
        } else if (side === 2) { // Bottom
            this.x = Math.random() * this.canvas.width;
            this.y = this.canvas.height + 10;
        } else { // Left
            this.x = -10;
            this.y = Math.random() * this.canvas.height;
        }

        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.radius = 2 + Math.random() * 2;
        this.color = '#00d2ff';
        this.hasDrug = true;
        this.drugReleasedInside = 0;
        this.drugReleasedOutside = 0;
        this.isInsideTumor = false;
        this.reachedTumor = false;
        this.releaseRate = 0.05;
        this.trail = [];
    }

    update(mode) {
        if (mode === 'guided') {
            // Steering towards tumor
            const dx = this.tumor.x - this.x;
            const dy = this.tumor.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize and apply force
            const force = 0.05;
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
            
            // Limit speed
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 2.5;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            // Triggered Drug Release
            this.releaseDrug('guided');
        } else {
            // Random movement (Brownian-ish)
            this.vx += (Math.random() - 0.5) * 1.0;
            this.vy += (Math.random() - 0.5) * 1.0;
            
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            const maxSpeed = 3.5;
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            // Continuous/Random release in random mode (inefficient)
            this.releaseDrug('random');
        }

        this.x += this.vx;
        this.y += this.vy;

        // Check if inside tumor
        const dx = this.tumor.x - this.x;
        const dy = this.tumor.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.isInsideTumor = dist < this.tumor.radius;
        if (this.isInsideTumor) this.reachedTumor = true;

        // Manage trail
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.shift();

        // Wrap around or reset if too far
        if (this.x < -100 || this.x > this.canvas.width + 100 || 
            this.y < -100 || this.y > this.canvas.height + 100) {
            this.reset();
        }
    }

    releaseDrug(mode) {
        if (!this.hasDrug) return;

        let shouldRelease = false;
        if (mode === 'guided') {
            // Triggered: only release if near tumor
            const dx = this.tumor.x - this.x;
            const dy = this.tumor.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.tumor.radius + 30) {
                shouldRelease = true;
            }
        } else {
            // Random: continuous leak
            shouldRelease = true;
        }

        if (shouldRelease) {
            const amount = this.releaseRate;
            if (this.isInsideTumor) {
                this.drugReleasedInside += amount;
            } else {
                this.drugReleasedOutside += amount;
            }
            // Visual feedback for release
            this.color = '#00ff88'; 
        }
    }

    draw() {
        // Draw trail
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.isInsideTumor ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 210, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.trail.length - 1; i++) {
            this.ctx.moveTo(this.trail[i].x, this.trail[i].y);
            this.ctx.lineTo(this.trail[i+1].x, this.trail[i+1].y);
        }
        this.ctx.stroke();

        // Draw particle
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.isInsideTumor ? '#00ff88' : this.color;
        this.ctx.shadowBlur = this.isInsideTumor ? 10 : 0;
        this.ctx.shadowColor = '#00ff88';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Reset color for next frame
        this.color = '#00d2ff';
    }
}

class Simulation {
    constructor() {
        this.canvas = document.getElementById('sim-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 100;
        this.tumor = { x: 0, y: 0, radius: 80 };
        this.isRunning = false;
        this.mode = 'guided'; // 'random' or 'guided'
        
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

        // Controls
        const startBtn = document.getElementById('start-btn');
        const resetBtn = document.getElementById('reset-btn');

        startBtn.addEventListener('click', () => {
            this.isRunning = !this.isRunning;
            startBtn.textContent = this.isRunning ? 'Pause Simulation' : 'Resume Simulation';
            document.getElementById('system-status').textContent = this.isRunning ? 'Active' : 'Paused';
        });

        resetBtn.addEventListener('click', () => this.reset());

        const modeRandomBtn = document.getElementById('mode-random');
        const modeGuidedBtn = document.getElementById('mode-guided');

        this.setMode = (mode) => {
            console.log('Switching to mode:', mode);
            this.mode = mode;
            document.getElementById('mode-random').classList.toggle('active', mode === 'random');
            document.getElementById('mode-guided').classList.toggle('active', mode === 'guided');
            document.getElementById('current-mode-display').textContent = 
                this.mode === 'guided' ? 'Guided + Triggered' : 'Random Delivery';
            this.reset();
        };

        modeRandomBtn.addEventListener('click', () => this.setMode('random'));
        modeGuidedBtn.addEventListener('click', () => this.setMode('guided'));

        // Expose to window for onclick handlers
        window.sim = this;

        // Initialize particles
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new Particle(this.canvas, this.tumor));
        }

        this.animate();
    }

    resize() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.tumor.x = this.canvas.width / 2;
        this.tumor.y = this.canvas.height / 2;
        
        // Position label
        const label = document.getElementById('label-tumor');
        label.style.left = `${this.tumor.x - 40}px`;
        label.style.top = `${this.tumor.y + this.tumor.radius + 10}px`;
    }

    reset() {
        this.particles.forEach(p => p.reset());
        this.metrics = {
            efficiency: 0,
            offTarget: 0,
            reachedTumor: 0,
            totalDrugInside: 0,
            totalDrugOutside: 0
        };
        this.updateMetricsUI();
    }

    updateMetrics() {
        let inside = 0;
        let outside = 0;
        let reached = 0;

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

    drawTumor() {
        // Outer glow
        const gradient = this.ctx.createRadialGradient(
            this.tumor.x, this.tumor.y, this.tumor.radius * 0.8,
            this.tumor.x, this.tumor.y, this.tumor.radius * 1.5
        );
        gradient.addColorStop(0, 'rgba(255, 77, 77, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 77, 77, 0)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.tumor.x, this.tumor.y, this.tumor.radius * 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Tumor body
        this.ctx.beginPath();
        this.ctx.arc(this.tumor.x, this.tumor.y, this.tumor.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 77, 77, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Inner fill
        this.ctx.fillStyle = 'rgba(255, 77, 77, 0.05)';
        this.ctx.fill();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawTumor();

        if (this.isRunning) {
            this.particles.forEach(p => p.update(this.mode));
            this.updateMetrics();
        }

        this.particles.forEach(p => p.draw());

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize simulation on load
window.onload = () => {
    new Simulation();
};
