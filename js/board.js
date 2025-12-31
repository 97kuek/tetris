class Board {
    constructor() {
        this.reset();
    }

    reset() {
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    collide(piece) {
        const m = piece.matrix;
        const o = { x: piece.x, y: piece.y };
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 &&
                    (this.grid[y + o.y] && this.grid[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    merge(piece) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.grid[y + piece.y][x + piece.x] = piece.colorId;
                }
            });
        });
    }

    sweep(game) {
        // Filter out full rows
        const rowsToKeep = this.grid.filter(row => row.some(value => value === 0));
        const rowsCleared = this.grid.length - rowsToKeep.length;

        if (rowsCleared > 0) {
            // Add new empty rows to the top
            const newRows = Array.from({ length: rowsCleared }, () => Array(COLS).fill(0));
            this.grid = [...newRows, ...rowsToKeep];

            game.addScore(rowsCleared);
            game.sound.playClear();
        }
    }
}
