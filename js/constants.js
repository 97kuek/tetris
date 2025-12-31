const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Standard Tetris Colors
const COLORS = [
    null,
    '#00f0f0', // I - Cyan
    '#0000f0', // J - Blue
    '#f0a000', // L - Orange
    '#f0f000', // O - Yellow
    '#00f000', // S - Green
    '#a000f0', // T - Purple
    '#f00000', // Z - Red
];

// Speed Curve (Frames per grid cell drop approx converted to ms)
// Using a smoother curve suitable for beginners to intermediate
function getDropInterval(level) {
    // Level 1: 1000ms (1 sec) - Easy
    // Level 5: 500ms - Moderate
    // Level 10: 150ms - Fast
    // Level 15: 50ms - Pro

    if (level > 20) return 20; // Cap at 20ms

    // Equation: (0.8-((level-1)*0.007))^(level-1) logic is complex.
    // Let's use a lookup table for the first 20 levels for precision.
    const speeds = [
        1000, // L1
        900,  // L2
        800,  // L3
        720,  // L4
        650,  // L5
        580,  // L6
        520,  // L7
        460,  // L8
        410,  // L9
        360,  // L10
        320,  // L11
        280,  // L12
        240,  // L13
        200,  // L14
        160,  // L15
        130,  // L16
        100,  // L17
        80,   // L18
        60,   // L19
        40    // L20
    ];

    return speeds[level - 1] || 20;
}

const LOCK_DELAY = 500; // ms
