import { SYSTEM_SIZE, TYPES, clamp } from './utils.js';

export class Simulation {
    constructor() {
        this.size = SYSTEM_SIZE;
        this.totalCells = this.size ** 3;
        
        // Double buffering for state
        // Arrays structure: [Index] -> Value
        this.typesA = new Uint8Array(this.totalCells); // Type ID
        this.energyA = new Float32Array(this.totalCells); // Energy 0-1
        this.typesB = new Uint8Array(this.totalCells);
        this.energyB = new Float32Array(this.totalCells);
        
        this.activeBuffer = 0; // 0 = A is current, 1 = B is current
        
        this.params = {
            entropy: 0.1,    // Random mutation chance
            affinity: 0.6,   // Crystal formation threshold
            speed: 5         // Updates per frame (handled in main loop)
        };
        
        this.stepCount = 0;
        this.activeCount = 0;
        
        // Precompute neighbor offsets for 3D Moore neighborhood (26 neighbors)
        this.neighborOffsets = [];
        for(let z=-1; z<=1; z++) {
            for(let y=-1; y<=1; y++) {
                for(let x=-1; x<=1; x++) {
                    if(x===0 && y===0 && z===0) continue;
                    this.neighborOffsets.push({x,y,z});
                }
            }
        }

        this.init();
    }

    init() {
        // Seed the universe
        const currentTypes = this.activeBuffer === 0 ? this.typesA : this.typesB;
        const currentEnergy = this.activeBuffer === 0 ? this.energyA : this.energyB;
        
        for(let i=0; i<this.totalCells; i++) {
            currentTypes[i] = TYPES.VOID;
            currentEnergy[i] = 0;
            
            // Seed a central cloud
            const z = Math.floor(i / (this.size * this.size));
            const y = Math.floor((i % (this.size * this.size)) / this.size);
            const x = i % this.size;
            
            const dx = x - this.size/2;
            const dy = y - this.size/2;
            const dz = z - this.size/2;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < 6 && Math.random() > 0.7) {
                currentTypes[i] = TYPES.DUST;
                currentEnergy[i] = Math.random();
            }
        }
        this.stepCount = 0;
    }

    // Helper to get 1D index from 3D coords (wrapped)
    getIndex(x, y, z) {
        // Wrap coordinates for toroidal topology
        const wx = (x + this.size) % this.size;
        const wy = (y + this.size) % this.size;
        const wz = (z + this.size) % this.size;
        return wz * (this.size * this.size) + wy * this.size + wx;
    }
    
    getCoords(index) {
        const z = Math.floor(index / (this.size * this.size));
        const y = Math.floor((index % (this.size * this.size)) / this.size);
        const x = index % this.size;
        return {x, y, z};
    }

    step() {
        const readT = this.activeBuffer === 0 ? this.typesA : this.typesB;
        const readE = this.activeBuffer === 0 ? this.energyA : this.energyB;
        
        const writeT = this.activeBuffer === 0 ? this.typesB : this.typesA;
        const writeE = this.activeBuffer === 0 ? this.energyB : this.energyA;
        
        let active = 0;
        let births = 0;
        let crystalizations = 0;

        // Iterate all cells
        for (let i = 0; i < this.totalCells; i++) {
            const myType = readT[i];
            const myEnergy = readE[i];
            const {x, y, z} = this.getCoords(i);

            // Count neighbors
            let dustNeighbors = 0;
            let crystalNeighbors = 0;
            let coreNeighbors = 0;
            let avgEnergy = 0;
            let totalN = 0;

            // Sample 6 Von Neumann neighbors for speed, or subset of 26
            // Let's do 6 (Face) + random diagonal for performance/chaos
            const offsets = [
                {x:1,y:0,z:0}, {x:-1,y:0,z:0},
                {x:0,y:1,z:0}, {x:0,y:-1,z:0},
                {x:0,y:0,z:1}, {x:0,y:0,z:-1}
            ];

            for (let o of offsets) {
                const nIdx = this.getIndex(x + o.x, y + o.y, z + o.z);
                const nType = readT[nIdx];
                if (nType !== TYPES.VOID) {
                    totalN++;
                    avgEnergy += readE[nIdx];
                    if (nType === TYPES.DUST) dustNeighbors++;
                    if (nType === TYPES.CRYSTAL) crystalNeighbors++;
                    if (nType === TYPES.CORE) coreNeighbors++;
                }
            }
            if (totalN > 0) avgEnergy /= totalN;

            // --- POTENTIALS (RULES) ---
            
            let newType = myType;
            let newEnergy = myEnergy * 0.95; // Natural decay

            // Rule 1: VOID Transformation (Birth)
            if (myType === TYPES.VOID) {
                // Dust condenses into new dust if enough neighbors
                if (dustNeighbors > 2 && Math.random() < 0.1) {
                    newType = TYPES.DUST;
                    newEnergy = 0.5;
                    births++;
                }
                // Spontaneous generation (Entropy)
                else if (Math.random() < this.params.entropy * 0.001) {
                    newType = TYPES.DUST;
                    newEnergy = 1.0;
                }
            }
            
            // Rule 2: DUST Behavior
            else if (myType === TYPES.DUST) {
                // High energy dust might become Core
                if (myEnergy > 0.9 && totalN > 4) {
                    newType = TYPES.CORE;
                } 
                // Dust near Crystal crystallizes (Affinity)
                else if (crystalNeighbors > 0 && Math.random() < this.params.affinity) {
                    newType = TYPES.CRYSTAL;
                    newEnergy += 0.2; // Release heat
                    crystalizations++;
                }
                // Overcrowding kills dust
                else if (totalN > 5) {
                    newType = TYPES.VOID; 
                }
                // Movement simulation: If I'm dust, and I have a void neighbor, 
                // I "moved" there in the previous step (handled by birth there), so I die here?
                // No, let's stick to state transition.
                // Survival:
                else {
                    // Gain energy from chaos
                    newEnergy += (Math.random() - 0.4) * 0.1;
                    if (newEnergy <= 0.05) newType = TYPES.VOID;
                }
            }
            
            // Rule 3: CRYSTAL Behavior
            else if (myType === TYPES.CRYSTAL) {
                // Stable, but decays if lonely or too energetic
                if (totalN < 2 && Math.random() < 0.05) newType = TYPES.DUST; // Crumble
                if (newEnergy > 0.8) newType = TYPES.CORE; // Compression
                newEnergy = clamp(newEnergy + 0.01, 0, 1); // Crystals store energy slowly
            }
            
            // Rule 4: CORE Behavior
            else if (myType === TYPES.CORE) {
                // Radiate energy, transform neighbors
                newEnergy = 1.0; // Always high
                if (Math.random() < 0.01) newType = TYPES.VOID; // Burnout
            }

            // Clamp and Write
            writeT[i] = newType;
            writeE[i] = clamp(newEnergy, 0, 1);
            
            if (newType !== TYPES.VOID) active++;
        }

        this.activeBuffer = this.activeBuffer === 0 ? 1 : 0;
        this.stepCount++;
        this.activeCount = active;
        
        return { births, crystalizations };
    }
    
    getCurrentState() {
        return {
            types: this.activeBuffer === 0 ? this.typesA : this.typesB,
            energy: this.activeBuffer === 0 ? this.energyA : this.energyB
        };
    }
    
    injectEnergy() {
        const currentEnergy = this.activeBuffer === 0 ? this.energyA : this.energyB;
        const currentTypes = this.activeBuffer === 0 ? this.typesA : this.typesB;
        for(let i=0; i<this.totalCells; i++) {
            if (currentTypes[i] !== TYPES.VOID) {
                currentEnergy[i] = 1.0;
                if (Math.random() < 0.2) currentTypes[i] = TYPES.DUST; // Scramble structure
            }
        }
    }
}