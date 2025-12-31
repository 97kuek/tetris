/**
 * このファイルは、テトリスゲームのメインロジックを管理するGameクラスを定義します。
 * ゲームの状態管理、ゲームループ、プレイヤーの入力処理、描画処理など、
 * ゲーム全体の流れをコントロールする中心的な役割を担います。
 */
class Game {
    /**
     * Gameクラスのコンストラクタ。
     * ゲームに必要なすべての要素を初期化します。
     */
    constructor() {
        // 描画対象となるcanvas要素とそのコンテキストを取得
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.holdCanvas = document.getElementById('hold-canvas');
        this.holdCtx = this.holdCanvas.getContext('2d');
        this.nextCanvas = document.getElementById('next-canvas');
        this.nextCtx = this.nextCanvas.getContext('2d');

        // 各種管理クラスのインスタンスを生成
        this.board = new Board(); // ゲーム盤
        this.sound = new SoundManager(); // サウンド
        this.generator = new PieceGenerator(); // ミノ生成器

        // ゲーム状態に関するプロパティ
        this.piece = null; // 現在操作中のミノ
        this.nextPiece = null; // 次に出現するミノ
        this.holdPiece = null; // ホールド中のミノ
        this.canHold = true; // ホールド可能かどうか

        // スコア関連
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        // ローカルストレージからハイスコアを読み込む。なければ0。
        this.highScore = parseInt(localStorage.getItem('tetris_high_score') || '0');

        // ゲームループと時間管理
        this.dropCounter = 0; // 落下タイミングを計るカウンター
        this.dropInterval = 1000; // 落下インターバル（ミリ秒）

        // ロックディレイ（接地後の遊び時間）の仕組みに関するプロパティ
        this.lockDelayCounter = 0; // ロックディレイのカウンター
        this.isLocking = false; // 接地してロックディレイが作動中か
        this.lockMoves = 0; // 接地中に動かした回数
        this.maxLockMoves = 15; // 接地中に動かせる最大回数（無限回転防止）

        // ゲームループの制御用
        this.lastTime = 0; // 前回のフレームからの経過時間計算用
        this.requestId = null; // requestAnimationFrameのID

        // ゲームの状態フラグ
        this.isPaused = false;
        this.isGameOver = false;
        this.isSoundInited = false; // サウンドが初期化済みか（ユーザー操作が必要なため）

        this.bindEvents(); // イベントリスナーを登録
        this.updateUI(); // UI（スコア表示など）を初期化
    }

    /**
     * キーボード入力やボタンクリックなどのイベントリスナーを登録します。
     */
    bindEvents() {
        document.addEventListener('keydown', (e) => this.handleInput(e));
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('restart-btn').addEventListener('click', () => this.start());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    }

    /**
     * ゲームを開始またはリスタートします。
     */
    start() {
        // サウンドはユーザーの初回インタラクションがないと再生できないため、ここで初期化
        if (!this.isSoundInited) {
            this.sound.init();
            this.isSoundInited = true;
        }

        // ゲーム状態をリセット
        this.board.reset();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = getDropInterval(this.level);
        this.updateUI();

        this.piece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.generator = new PieceGenerator(); // ミノの出現順をリセット

        this.nextPiece = this.generator.next(); // 最初のNEXTミノを生成
        this.spawnPiece(); // 最初のミノを盤面に出現させる

        this.isPaused = false;
        this.isGameOver = false;

        // 各種オーバーレイを非表示にする
        document.getElementById('start-overlay').classList.add('hidden');
        document.getElementById('game-over-overlay').classList.add('hidden');
        document.getElementById('pause-overlay').classList.add('hidden');

        // ゲームループを開始
        if (this.requestId) cancelAnimationFrame(this.requestId); // 既存のループがあればキャンセル
        this.lastTime = 0;
        // requestAnimationFrameで滑らかなアニメーションループを実現
        this.requestId = requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * 新しいミノを盤面の上部に出現させます。
     */
    spawnPiece() {
        this.piece = this.nextPiece; // NEXTミノを現在のミノに設定
        // 盤面中央の上部に出現させる
        this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
        this.piece.y = 0;
        this.piece.rotation = 0; // 回転状態を初期化

        this.nextPiece = this.generator.next(); // 新しいNEXTミノを準備
        this.drawPreview(this.nextCtx, this.nextPiece); // NEXT表示を更新
        this.canHold = true; // ホールドを可能にする

        this.resetLockDelay(); // ロックディレイの状態をリセット

        // 出現直後に他のブロックと衝突する場合、ゲームオーバー
        if (this.board.collide(this.piece)) {
            this.gameOver();
        }
    }

    /**
     * ロックディレイ関連の変数をリセットします。
     */
    resetLockDelay() {
        this.isLocking = false;
        this.lockDelayCounter = 0;
        this.lockMoves = 0;
    }

    /**
     * 現在のミノをホールドします。
     */
    switchHold() {
        if (!this.canHold || this.isPaused || this.isGameOver) return; // ホールド不可なら何もしない

        // 現在のミノの情報を保持（回転はリセットする）
        const currentType = this.piece.type;
        const freshPieceDef = PIECES_DEF[currentType];

        if (this.holdPiece) {
            // ホールド中のミノがある場合、現在のミノと入れ替える
            const temp = this.holdPiece;
            this.holdPiece = { type: currentType, matrix: freshPieceDef, colorId: this.piece.colorId };
            this.piece = temp;
            // 新しいミノを中央上部に配置
            this.piece.x = Math.floor((COLS - this.piece.matrix[0].length) / 2);
            this.piece.y = 0;
            this.piece.rotation = 0;
        } else {
            // ホールド中のミノがない場合、現在のミノをホールドし、新しいミノをスポーンする
            this.holdPiece = { type: currentType, matrix: freshPieceDef, colorId: this.piece.colorId };
            this.spawnPiece();
        }

        this.resetLockDelay();
        this.drawPreview(this.holdCtx, this.holdPiece); // ホールド表示を更新
        this.canHold = false; // 一度ホールドしたら、次のミノが固定されるまでホールド不可
        this.sound.playMove();
    }

    /**
     * ゲームのメインループ。毎フレームこの関数が呼び出されます。
     * @param {number} time - requestAnimationFrameから渡されるタイムスタンプ
     */
    loop(time = 0) {
        if (this.isPaused || this.isGameOver) return; // ポーズ中やゲームオーバーならループを停止

        const dt = time - this.lastTime; // 経過時間 (delta time)
        this.lastTime = time;

        this.dropCounter += dt;

        // 自然落下処理
        if (this.dropCounter > this.dropInterval) {
            this.update(0, 1); // 1マス下に移動
            this.dropCounter = 0;
        }

        // ロックディレイのロジック
        if (this.isPieceOnGround()) { // ミノが接地しているか？
            if (!this.isLocking) { // 接地した瞬間
                this.isLocking = true;
                this.lockDelayCounter = 0;
            }
            this.lockDelayCounter += dt; // 接地時間をカウント

            // 接地時間がロックディレイを超えたらミノを固定
            if (this.lockDelayCounter > LOCK_DELAY) {
                this.lockPiece();
            }
        } else {
            // 空中にいる場合はロック状態を解除
            this.isLocking = false;
            this.lockDelayCounter = 0;
        }

        this.draw(); // 描画処理を呼び出す
        this.requestId = requestAnimationFrame((t) => this.loop(t)); // 次のフレームを要求
    }

    /**
     * ミノが地面または他のブロックに接地しているかを確認します。
     * @returns {boolean} - 接地していればtrue
     */
    isPieceOnGround() {
        this.piece.y++; // 1マス下に仮移動
        const collision = this.board.collide(this.piece); // 衝突判定
        this.piece.y--; // 元の位置に戻す
        return collision;
    }

    /**
     * ミノを移動させます。
     * @param {number} dx - X方向の移動量
     * @param {number} dy - Y方向の移動量
     * @returns {boolean} - 移動が成功したか
     */
    update(dx, dy) {
        this.piece.x += dx;
        this.piece.y += dy;

        if (this.board.collide(this.piece)) {
            // 衝突したら移動をキャンセル
            this.piece.x -= dx;
            this.piece.y -= dy;
            return false;
        }

        // 接地中に移動が成功した場合、ロックディレイをリセット
        if (this.isLocking) {
            this.handleLockReset();
        }

        return true;
    }

    /**
     * ミノを回転させます。SRS（スーパーローテーションシステム）を実装しています。
     */
    rotate() {
        const p = this.piece;
        const currentMatrix = p.matrix;
        const newMatrix = rotateMatrix(currentMatrix, 1); // 時計回りに回転
        const currentRot = p.rotation || 0;
        const newRot = (currentRot + 1) % 4; // 次の回転状態

        // SRSの回転補正値を取得
        const kicks = getSRSOffsets(p.type, currentRot, newRot);

        // 回転前の状態を保存
        const originalX = p.x;
        const originalY = p.y;

        // 回転後のミノを配置
        p.matrix = newMatrix;

        // 5種類の補正（キック）を試す (0番目は補正なし)
        for (let i = 0; i < kicks.length; i++) {
            const [ox, oy] = kicks[i];
            p.x = originalX + ox;
            // SRSのY座標は上が+だが、CanvasのY座標は下が+なので、補正値を反転させる
            p.y = originalY - oy;

            // 衝突しなければ回転成功
            if (!this.board.collide(p)) {
                p.rotation = newRot;
                this.sound.playRotate();
                // 接地中に回転した場合、ロックディレイをリセット
                if (this.isLocking) {
                    this.handleLockReset();
                }
                return; // 成功したので処理を抜ける
            }
        }

        // すべてのキックを試しても失敗した場合、回転を元に戻す
        p.matrix = currentMatrix;
        p.x = originalX;
        p.y = originalY;
    }

    /**
     * 接地中にミノを動かした場合にロックディレイのタイマーをリセットします。
     * 無限に回転できてしまうのを防ぐため、回数制限を設けています。
     */
    handleLockReset() {
        if (this.lockMoves < this.maxLockMoves) {
            this.lockDelayCounter = 0; // タイマーをリセット
            this.lockMoves++; // 移動回数をカウント
        }
    }

    /**
     * ハードドロップ（瞬時に一番下まで落とす）処理。
     */
    hardDrop() {
        // 衝突するまで下に移動させる
        while (!this.board.collide(this.piece)) {
            this.piece.y++;
        }
        this.piece.y--; // 衝突する1マス上に戻す
        this.lockPiece(); // ミノを固定
        this.sound.playDrop();
    }

    /**
     * ミノを盤面に固定し、次のミノを出現させます。
     */
    lockPiece() {
        this.board.merge(this.piece); // 盤面にミノを書き込む
        this.sound.playLock();
        this.board.sweep(this); // 揃ったラインを消去
        this.spawnPiece(); // 次のミノを出現させる
    }

    /**
     * スコアとレベルを更新します。
     * @param {number} rows - 消去したライン数
     */
    addScore(rows) {
        // ライン数に応じたスコアテーブル
        const points = [0, 100, 300, 500, 800];
        this.score += points[rows] * this.level;
        this.lines += rows;
        // 10ライン消すごとにレベルアップ
        this.level = Math.floor(this.lines / 10) + 1;
        this.dropInterval = getDropInterval(this.level); // レベルに応じて落下速度を更新

        // ハイスコア更新
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('tetris_high_score', this.highScore); // ローカルストレージに保存
        }

        this.updateUI();
    }

    /**
     * ゲームオーバー処理。
     */
    gameOver() {
        this.isGameOver = true;
        this.sound.playGameOver();
        cancelAnimationFrame(this.requestId); // ゲームループを停止
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden'); // ゲームオーバー画面を表示
    }

    /**
     * ゲームをポーズまたは再開します。
     */
    togglePause() {
        if (!this.isSoundInited) { this.sound.init(); this.isSoundInited = true; }

        if (this.isPaused) {
            this.isPaused = false;
            document.getElementById('pause-overlay').classList.add('hidden');
            // ループを再開
            this.lastTime = performance.now();
            this.loop(this.lastTime);
        } else {
            this.isPaused = true;
            cancelAnimationFrame(this.requestId); // ループを停止
            document.getElementById('pause-overlay').classList.remove('hidden');
        }
    }

    /**
     * プレイヤーのキーボード入力を処理します。
     * @param {KeyboardEvent} e - キーボードイベント
     */
    handleInput(e) {
        if (this.isGameOver) return;
        if (e.code === 'KeyP') { this.togglePause(); return; } // Pキーでポーズ
        if (this.isPaused) return;

        // ゲームキーによるページのスクロールを防止
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }

        if (e.code === 'ArrowLeft') { // 左移動
            if (this.update(-1, 0)) this.sound.playMove();
        } else if (e.code === 'ArrowRight') { // 右移動
            if (this.update(1, 0)) this.sound.playMove();
        } else if (e.code === 'ArrowDown') { // ソフトドロップ
            if (this.update(0, 1)) {
                this.score += 1; // ソフトドロップで1点加算
                this.updateUI();
            }
        } else if (e.code === 'ArrowUp') { // 回転
            this.rotate();
        } else if (e.code === 'Space') { // ハードドロップ
            this.hardDrop();
        } else if (e.code === 'KeyC') { // ホールド
            this.switchHold();
        }
        this.draw(); // 入力後すぐに再描画して反応を良く見せる
    }

    /**
     * ゲーム画面全体を描画します。
     */
    draw() {
        // 背景をクリア
        this.ctx.fillStyle = '#0d0f1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 固定されたブロック（盤面）を描画
        this.drawMatrix(this.board.grid, { x: 0, y: 0 });

        if (this.piece) {
            // ゴーストピース（落下予測位置）を描画
            const ghost = { ...this.piece, matrix: this.piece.matrix, y: this.piece.y };
            while (!this.board.collide(ghost)) {
                ghost.y++;
            }
            ghost.y--;
            this.drawMatrix(ghost.matrix, { x: ghost.x, y: ghost.y }, ghost.colorId, true);

            // 現在操作中のミノを描画
            this.drawMatrix(this.piece.matrix, { x: this.piece.x, y: this.piece.y }, this.piece.colorId);
        }
    }

    /**
     * マトリックス（2次元配列）を描画する汎用関数。盤面やミノの描画に使用します。
     * @param {number[][]} matrix - 描画する2次元配列
     * @param {{x: number, y: number}} offset - 描画位置のオフセット
     * @param {number|null} colorIdOverride - 色を上書きする場合の色ID
     * @param {boolean} isGhost - ゴーストピースとして描画するか
     */
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
                        // ゴーストピースのスタイル（半透明の枠線）
                        this.ctx.globalAlpha = 0.3;
                        this.ctx.fillStyle = color;
                        this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                        this.ctx.globalAlpha = 1.0;
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        this.ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
                    } else {
                        // 通常のミノのスタイル
                        this.ctx.fillStyle = color;
                        this.drawRoundedRect(this.ctx, px, py, BLOCK_SIZE, BLOCK_SIZE, 3);

                        // 立体感を出すためのハイライト効果
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        this.ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE / 4);
                    }
                }
            });
        });
    }

    /**
     * NEXTとHOLDのプレビューを描画します。
     * @param {CanvasRenderingContext2D} ctx - 描画先のコンテキスト
     * @param {Piece} piece - 描画するミノ
     */
    drawPreview(ctx, piece) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!piece) return;

        const boxSize = 20; // プレビュー用のブロックサイズ
        const w = piece.matrix[0].length * boxSize;
        const h = piece.matrix.length * boxSize;
        // プレビューエリアの中央に表示するためのオフセット計算
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

    /**
     * 角丸の四角形を描画するヘルパー関数。
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        // `roundRect`は比較的新しいAPIですが、モダンブラウザでは広くサポートされています。
        ctx.roundRect(x + 1, y + 1, width - 2, height - 2, radius);
        ctx.fill();
    }

    /**
     * スコア、レベル、ライン数のUI表示を更新します。
     */
    updateUI() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('level').innerText = this.level;
        document.getElementById('lines').innerText = this.lines;
        document.getElementById('high-score').innerText = this.highScore;
    }
}
