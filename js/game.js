class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.holdCanvas = document.getElementById('hold-canvas');
        this.holdCtx = this.holdCanvas.getContext('2d');
        this.nextCanvas = document.getElementById('next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');

        this.board = new Board();
        this.sound = new SoundManager();
        this.generator = new PieceGenerator();

        this.piece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;

        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0');

        this.dropCounter = 0;
        this.dropInterval = 1000;

        // Lock Delay Mechanics
        this.lockDelayCounter = 0;
        this.isLocking = false;
        this.lockMoves = 0; // "Infinity" rule: max 15 moves/rotates per lock phase
        this.maxLockMoves = 15;

        this.lastTime = 0;
        this.requestId = null;

        this.isPaused = false;
        this.isGameOver = false;
        this.isSoundInited = false;

        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => this.handleInput(e));
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => this.start());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    }

    start() {
        if (!this.isSoundInited) {
            this.sound.init();
            this.isSoundInited = true;
        }

        this.board.reset();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = getDropInterval(this.level);
        this.updateUI();

        this.piece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.generator = new PieceGenerator();

        this.nextPiece = this.generator.next();
        this.spawnPiece();

        this.isPaused = false;
        this.isGameOver = false;

        document.getElementById('start-overlay').classList.add('hidden');
        document.getElementById('game-over-overlay').classList.add('hidden');
        document.getElementById('pause-overlay').classList.add('hidden');

        if (this.requestId) cancelAnimationFrame(this.requestId);
        this.lastTime = 0;
        this.requestId = requestAnimationFrame((t) => this.loop(t));
    }

    spawnPiece() {
        this.piece = this.nextPiece;
        this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
        this.piece.y = 0;
        this.piece.rotation = 0; // Track rotation state (0-3) for SRS

        this.nextPiece = this.generator.next();
        this.drawPreview(this.nextCtx, this.nextPiece);
        this.canHold = true;

        this.resetLockDelay();

        // Game Over check immediately on spawn
        if (this.board.collide(this.piece)) {
            this.gameOver();
        }
    }

    resetLockDelay() {
        this.isLocking = false;
        this.lockDelayCounter = 0;
        this.lockMoves = 0;
    }

    switchHold() {
        if (!this.canHold || this.isPaused || this.isGameOver) return;

        const current = {
            matrix: this.piece.matrix,
            colorId: this.piece.colorId,
            type: this.piece.type
        };
        const fresh = PIECES_DEF[current.type]; // Reset rotation

        if (this.holdPiece) {
            const temp = this.holdPiece;
            this.holdPiece = { ...current, matrix: fresh.map(row => [...row]) };
            this.piece = temp;
            this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
            this.piece.y = 0;
            this.piece.rotation = 0;
        } else {
            this.holdPiece = { ...current, matrix: fresh.map(row => [...row]) };
            this.spawnPiece();
            // spawnPiece already resets lock delay.
            // But strict "swap" shouldn't necessarily spawn from NEXT if we had a hold?
            // "Else" means we had NO hold. So we take current to hold, and bring NEXT to current. Correct.
        }

        // We need to re-verify the "Swap resets lock delay" rule. Yes, mostly.
        this.resetLockDelay();
        this.drawPreview(this.holdCtx, this.holdPiece);
        this.canHold = false;
        this.sound.playMove(); // Audio feedback
    }

    loop(time = 0) {
        if (this.isPaused || this.isGameOver) return;

        const dt = time - this.lastTime;
        this.lastTime = time;

        this.dropCounter += dt;

        // Gravity
        if (this.dropCounter > this.dropInterval) {
            this.update(0, 1);
            this.dropCounter = 0;
        }

        // Lock Delay Logic
        if (this.isPieceOnGround()) {
            if (!this.isLocking) {
                this.isLocking = true;
                this.lockDelayCounter = 0;
            }
            this.lockDelayCounter += dt;

            // Standard Lock Delay or strict hard limit?
            // "Infinity" rule allows infinite time as long as you move/rotate, 
            // BUT there is usually a limit on number of moves (15) OR a hard time limit.
            // Here we use the move counters (handled in update/rotate).
            // We just check the timer here.

            if (this.lockDelayCounter > LOCK_DELAY) {
                this.lockPiece();
            }
        } else {
            this.isLocking = false; // Left ground, reset lock state
            this.lockDelayCounter = 0;
            // Note: In strict Infinity, leaving ground doesn't reset 'lockMoves' counter, 
            // but for simple "Improved" feel, resetting it is fine usually.
            // Let's keep it simple: if you leave ground, you are free.
        }

        this.draw();
        this.requestId = requestAnimationFrame((t) => this.loop(t));
    }

    isPieceOnGround() {
        this.piece.y++;
        const collision = this.board.collide(this.piece);
        this.piece.y--;
        return collision;
    }

    update(dx, dy) {
        this.piece.x += dx;
        this.piece.y += dy;

        if (this.board.collide(this.piece)) {
            this.piece.x -= dx;
            this.piece.y -= dy;
            return false;
        }

        // If move successful and we were locking
        if (this.isLocking) {
            this.handleLockReset();
        }

        return true;
    }

    rotate() {
        const p = this.piece;
        const currentMatrix = p.matrix;
        const newMatrix = rotateMatrix(currentMatrix, 1); // 1 = Clockwise
        const currentRot = p.rotation || 0;
        const newRot = (currentRot + 1) % 4;

        // Get SRS Kicks
        const kicks = getSRSOffsets(p.type, currentRot, newRot);

        // Clone current matrix for revert
        const originalMatrix = currentMatrix.map(row => [...row]);
        const originalX = p.x;
        const originalY = p.y;

        // Try kicks
        for (let i = 0; i < kicks.length; i++) {
            const [ox, oy] = kicks[i];
            p.x = originalX + ox;
            p.y = originalY - oy; // Y is inverted in standard SRS tables (Up is positive) vs Canvas (Down is positive)
            // Wait, verify SRS table direction.
            // Standard SRS data: (+x is right, +y is UP). Canvas: (+y is DOWN).
            // So if table says (0, 1), it means Up 1. In canvas that is y - 1.
            // CORRECT: p.y = originalY - oy.

            p.matrix = newMatrix;

            if (!this.board.collide(p)) {
                // Successful Rotation
                p.rotation = newRot;
                this.sound.playRotate();
                if (this.isLocking) {
                    this.handleLockReset();
                }
                return;
            } else {
                // Revert to try next kick
                p.matrix = currentMatrix;
                p.x = originalX;
                p.y = originalY;
            }
        }
        // Rotation Failed
    }

    handleLockReset() {
        // Only reset up to a limit
        if (this.lockMoves < this.maxLockMoves) {
            this.lockDelayCounter = 0;
            this.lockMoves++;
        }
    }

    hardDrop() {
        while (!this.board.collide(this.piece)) {
            this.piece.y++;
        }
        this.piece.y--;
        this.lockPiece();
        this.sound.playDrop();
    }

    lockPiece() {
        this.board.merge(this.piece);
        this.sound.playLock();
        this.board.sweep(this);
        this.spawnPiece();
    }

    addScore(rows) {
        // Standard Scoring (Nintendo Guidance System)
        // 1: 100, 2: 300, 3: 500, 4: 800 (multiplied by level)
        const points = [0, 100, 300, 500, 800];
        this.score += points[rows] * this.level;
        this.lines += rows;
        this.level = Math.floor(this.lines / 10) + 1;
        this.dropInterval = getDropInterval(this.level);

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetris_high_score', this.highScore);
        }

        this.updateUI();
    }

    gameOver() {
        this.isGameOver = true;
        this.sound.playGameOver();
        cancelAnimationFrame(this.requestId);
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    togglePause() {
        if (!this.isSoundInited) { this.sound.init(); this.isSoundInited = true; }

        if (this.isPaused) {
            this.isPaused = false;
            document.getElementById('pause-overlay').classList.add('hidden');
            this.lastTime = performance.now();
            this.loop(this.lastTime);
        } else {
            this.isPaused = true;
            cancelAnimationFrame(this.requestId);
            document.getElementById('pause-overlay').classList.remove('hidden');
        }
    }

    handleInput(e) {
        if (this.isGameOver) return;
        if (e.code === 'KeyP') { this.togglePause(); return; }
        if (this.isPaused) return;

        // Prevent default scrolling for game keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }

        if (e.code === 'ArrowLeft') {
            if (this.update(-1, 0)) this.sound.playMove();
        } else if (e.code === 'ArrowRight') {
            if (this.update(1, 0)) this.sound.playMove();
        } else if (e.code === 'ArrowDown') {
            if (this.update(0, 1)) {
                this.score += 1; // Soft drop points
                this.updateUI();
            }
        } else if (e.code === 'ArrowUp') {
            this.rotate();
        } else if (e.code === 'Space') {
            this.hardDrop();
        } else if (e.code === 'KeyC') {
            this.switchHold();
        }
        this.draw();
    }

    draw() {
        this.ctx.fillStyle = '#0d0f1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawMatrix(this.board.grid, { x: 0, y: 0 });

        if (this.piece) {
            // Draw Ghost
            const ghost = { ...this.piece, matrix: this.piece.matrix, y: this.piece.y };
            while (!this.board.collide(ghost)) {
                ghost.y++;
            }
            ghost.y--;
            this.drawMatrix(ghost.matrix, { x: ghost.x, y: ghost.y }, ghost.colorId, true);

            // Draw Active Piece
            this.drawMatrix(this.piece.matrix, { x: this.piece.x, y: this.piece.y }, this.piece.colorId);
        }
    }

    drawMatrix(matrix, offset, colorIdOverride = null, isGhost = false) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                let colorIndex = value;
                if (colorIdOverride !== null && value !== 0) colorIndex = colorIdOverride;

                if (colorIndex !== 0) {
                    const color = COLORS[colorIndex];
                    const px = (x + offset.x) * BLOCK_SIZE;
                    const py = (y + offset.y) * BLOCK_SIZE;

                    if (isGhost) {
                        this.ctx.globalAlpha = 0.3;
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                        this.ctx.globalAlpha = 1.0;
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        this.ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                    } else {
                        // Simple flat look for minimal aesthetic
                        this.ctx.fillStyle = color;
                        this.drawRoundedRect(this.ctx, px, py, BLOCK_SIZE, BLOCK_SIZE, 3);

                        // Mild bevel effect
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE / 4);
                    }
                }
            });
        });
    }

    drawPreview(ctx, piece) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!piece) return;

        const boxSize = 20;
        const w = piece.matrix[0].length * boxSize;
        const h = piece.matrix.length * boxSize;
        const ox = (ctx.canvas.width - w) / 2;
        const oy = (ctx.canvas.height - h) / 2;

        ctx.fillStyle = COLORS[piece.colorId];
        piece.matrix.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val !== 0) {
                    ctx.fillRect(ox + x * boxSize, oy + y * boxSize, boxSize - 2, boxSize - 2);
                }
            });
        });
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, width - 2, height - 2, radius);
        ctx.fill();
    }

    addAlpha(color, alpha) {
        // Helper if needed, though simple globalAlpha is often better for performance and simplicity
        return color;
    }

    updateUI() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('level').innerText = this.level;
        document.getElementById('lines').innerText = this.lines;
        document.getElementById('high-score').innerText = this.highScore;
    }
}
