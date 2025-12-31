class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (this.isMuted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    playMove() { this.playTone(300, 'square', 0.05, 0.05); }
    playRotate() { this.playTone(400, 'triangle', 0.05, 0.05); }
    playDrop() { this.playTone(150, 'sawtooth', 0.1, 0.1); }
    playLock() { this.playTone(200, 'square', 0.1, 0.1); }
    playClear() {
        this.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 100);
    }
    playGameOver() {
        if (this.isMuted || !this.ctx) return;
        this.playTone(150, 'sawtooth', 0.5, 0.2);
        setTimeout(() => this.playTone(100, 'sawtooth', 1.0, 0.2), 400);
    }
}
