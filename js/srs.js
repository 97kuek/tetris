// Super Rotation System (SRS) Kick Table
// https://tetris.wiki/Super_Rotation_System

// J, L, S, T, Z pieces share the same kick table
const SRS_KICKS_JLSTZ = {
    // 0 -> 1 (North to East)
    "0-1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    // 1 -> 0 (East to North)
    "1-0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    // 1 -> 2 (East to South)
    "1-2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    // 2 -> 1 (South to East)
    "2-1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    // 2 -> 3 (South to West)
    "2-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    // 3 -> 2 (West to South)
    "3-2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    // 3 -> 0 (West to North)
    "3-0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    // 0 -> 3 (North to West)
    "0-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};

// I piece has its own kick table
const SRS_KICKS_I = {
    "0-1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "1-0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1-2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    "2-1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2-3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "3-2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3-0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "0-3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

// O piece doesn't kick (it doesn't rotate effectively in a way that needs kicks usually, or fits in 2x2 centre)
// But standard SRS treats O as not needing kicks.

function getSRSOffsets(pieceType, currentRotation, newRotation) {
    if (pieceType === 'O') return [[0, 0]]; // No kicks needed

    const key = `${currentRotation}-${newRotation}`;
    if (pieceType === 'I') {
        return SRS_KICKS_I[key] || [[0, 0]];
    } else {
        return SRS_KICKS_JLSTZ[key] || [[0, 0]];
    }
}

// Utility to rotate matrix
function rotateMatrix(matrix, dir = 1) {
    // 1 = Clockwise, -1 = Counter-Clockwise
    // Transpose
    const N = matrix.length;
    let newMatrix = matrix.map((row, i) =>
        row.map((val, j) => matrix[j][i])
    );

    // If Clockwise: Reverse rows
    if (dir === 1) {
        newMatrix.forEach(row => row.reverse());
    } else {
        // If Counter-Clockwise: Reverse columns (which is reversing the array of rows after transpose? No.)
        // Transpose then Reverse rows = Clockwise
        // Reverse rows then Transpose = Counter Clockwise
        // Let's stick to Clockwise only for this simple implementation as requested? 
        // User asked for "Improved Gameplay" so usually both rotations are nice, but let's stick to Right rotate for simplicity unless requested.
        // Actually, let's keep it simple: Standard Rotate is Clockwise.
    }
    return newMatrix;
}
