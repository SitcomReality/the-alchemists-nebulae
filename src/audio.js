export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.droneNode = null;
        this.gainNode = null;
        this.isInit = false;
    }

    async init() {
        if (this.isInit) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.4;
        this.gainNode.connect(this.ctx.destination);
        
        // Load assets
        await this.loadBuffer('drone', 'drone_ambience.mp3');
        await this.loadBuffer('chime', 'crystal_chime.mp3');
        
        this.isInit = true;
        this.startDrone();
    }

    async loadBuffer(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers = this.buffers || {};
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.warn("Audio load failed", e);
        }
    }

    startDrone() {
        if (!this.buffers || !this.buffers.drone) return;
        
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.drone;
        source.loop = true;
        
        // Lowpass filter for "underwater" space feel
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        
        source.connect(filter);
        filter.connect(this.gainNode);
        source.start(0);
        this.droneNode = source;
    }

    playChime(pitch = 1.0) {
        if (!this.buffers || !this.buffers.chime) return;
        
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.chime;
        source.playbackRate.value = pitch;
        
        const gain = this.ctx.createGain();
        gain.gain.value = 0.3;
        
        source.connect(gain);
        gain.connect(this.gainNode);
        source.start(0);
    }

    // Generative synthesis for rapid events
    playSpark() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + Math.random() * 1000, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(this.gainNode);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
}

