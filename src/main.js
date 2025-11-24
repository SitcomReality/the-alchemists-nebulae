import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { AudioSystem } from './audio.js';

const container = document.getElementById('canvas-container');
const uiStats = document.getElementById('stats-display');
const startOverlay = document.getElementById('start-overlay');

// UI Elements
const entropySlider = document.getElementById('entropy');
const affinitySlider = document.getElementById('affinity');
const speedSlider = document.getElementById('speed');
const resetBtn = document.getElementById('reset-btn');
const mutateBtn = document.getElementById('mutate-btn');

const sim = new Simulation();
const renderer = new Renderer(container);
const audio = new AudioSystem();

let isPlaying = false;
let lastTime = 0;
let frameCount = 0;

function init() {
    // Bind UI
    entropySlider.addEventListener('input', (e) => sim.params.entropy = e.target.value / 100);
    affinitySlider.addEventListener('input', (e) => sim.params.affinity = e.target.value / 100);
    speedSlider.addEventListener('input', (e) => sim.params.speed = parseInt(e.target.value));

    resetBtn.addEventListener('click', () => {
        sim.init();
        audio.playSpark();
    });
    mutateBtn.addEventListener('click', () => {
        sim.injectEnergy();
        audio.playSpark();
    });

    startOverlay.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        audio.init().then(() => {
            isPlaying = true;
            loop(0);
        });
    });
}

function loop(time) {
    requestAnimationFrame(loop);

    if (!isPlaying) return;

    const delta = time - lastTime;

    // Throttle simulation updates, but render every frame
    // We can run multiple sim steps per render frame if speed is high
    if (frameCount % (21 - sim.params.speed) === 0) {
        const events = sim.step();

        // Audio feedback
        if (events.crystalizations > 5) {
            audio.playChime(1.0 + Math.random() * 0.5);
        } else if (events.births > 20) {
            // subtle crackle
        }

        uiStats.innerText = `Step: ${sim.stepCount} | Entities: ${sim.activeCount}`;
    }

    renderer.render(sim);
    frameCount++;
    lastTime = time;
}

init();