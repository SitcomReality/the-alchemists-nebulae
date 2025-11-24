export const SYSTEM_SIZE = 24; // Grid size 24x24x24 = 13,824 cells
export const TYPES = {
    VOID: 0,
    DUST: 1,    // Chaotic, high energy
    CRYSTAL: 2, // Stable, structural
    CORE: 3     // Dense, transforms neighbors
};

export const PALETTE = {
    [TYPES.VOID]: new Float32Array([0, 0, 0]),
    [TYPES.DUST]: new Float32Array([0.2, 0.6, 1.0]),   // Cyan/Blue
    [TYPES.CRYSTAL]: new Float32Array([0.8, 0.2, 0.9]), // Magenta/Purple
    [TYPES.CORE]: new Float32Array([1.0, 0.9, 0.4])     // Gold/White
};

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

