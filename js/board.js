// board.js では、盤面の状態管理・ミノの衝突判定・ミノの固定・ラインの消去などの役割を担う
class Board {
    /**
     * Boardクラスのコンストラクタ。
     * 新しいBoardオブジェクトが作成されるときに呼び出されます。
     */
    constructor() {
        // ゲーム開始時やリセット時に盤面を初期化します。
        this.reset();
    }

    // reset() メソッドは、盤面を初期状態にリセットする
    reset() {
        // `ROWS`と`COLS`は`constants.js`で定義された盤面の行数と列数です。
        // `Array.from`を使って、指定された長さの配列を生成します。
        // 各行は、すべての要素が0で埋められた配列になります。
        // `this.grid`が盤面そのものを表す2次元配列です。0は空のセルを意味します。
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    // collide() メソッドは、指定されたミノが盤面上の他のブロックと衝突するかどうかを判定する
    collide(piece) {
        // m: ミノの形状を表す2次元配列 (e.g., [[0,1,0],[1,1,1]])
        // o: ミノの盤面上のオフセット（左上の座標）
        const m = piece.matrix;
        const o = { x: piece.x, y: piece.y };

        // ミノの形状配列をループして、ブロック（値が0でない部分）をチェックします。
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                // `m[y][x] !== 0` : ミノの形状で、ブロックが存在する部分かを確認。
                // `this.grid[y + o.y]` : 盤面のy座標が範囲内かを確認。
                // `this.grid[y + o.y][x + o.x]` : 盤面のx座標が範囲内かを確認。
                // `... !== 0` : 盤面のその位置に既にブロック（値が0でない）が置かれているかを確認。
                if (m[y][x] !== 0 && // ミノのブロックがある
                    (this.grid[y + o.y] && this.grid[y + o.y][x + o.x]) !== 0) { // かつ、盤面の対応する位置が空(0)ではない
                    // 衝突している場合はtrueを返します。
                    return true;
                }
            }
        }
        // ループが完了しても衝突がなければ、falseを返します。
        return false;
    }

    /**
     * ミノを盤面に固定（マージ）します。
     * 操作中のミノがそれ以上落下できなくなったときに呼び出されます。
     * @param {Piece} piece - 固定するミノオブジェクト。
     */
    merge(piece) {
        // ミノの形状配列をループします。
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                // ミノのブロック（値が0でない部分）だけを処理します。
                if (value !== 0) {
                    // ミノの盤面上の座標に対応する`this.grid`の位置に、
                    // ミノの色ID (`piece.colorId`)を書き込みます。
                    // これにより、ミノが盤面の一部となります。
                    this.grid[y + piece.y][x + piece.x] = piece.colorId;
                }
            });
        });
    }

    /**
     * 揃った行を消去し、スコアを加算します。
     * @param {Game} game - Gameオブジェクト。スコア加算やサウンド再生のために使います。
     */
    sweep(game) {
        // `filter`メソッドを使って、すべてのセルが埋まっていない行だけを残します。
        // `row.some(value => value === 0)`は、行内に1つでも空のセル(0)があればtrueを返します。
        const rowsToKeep = this.grid.filter(row => row.some(value => value === 0));

        // 消去された行数を計算します。
        const rowsCleared = this.grid.length - rowsToKeep.length;

        // 消去された行が1行以上ある場合
        if (rowsCleared > 0) {
            // 消去された行数分の新しい空の行を作成します。
            const newRows = Array.from({ length: rowsCleared }, () => Array(COLS).fill(0));

            // 新しい空の行を盤面の上部に追加し、残った行と結合します。
            // これにより、消えた行の分だけ上のブロックが下にずり落ちる効果が生まれます。
            this.grid = [...newRows, ...rowsToKeep];

            // Gameオブジェクトのメソッドを呼び出してスコアを加算します。
            game.addScore(rowsCleared);
            // 消去時の効果音を再生します。
            game.sound.playClear();
        }
    }
}
