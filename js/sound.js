// ゲームの効果音を生成・再生するコード

// Web Audio APIを使用して音を合成するSoundManagerクラス
class SoundManager {
    constructor() {
        // AudioContextは、音声処理グラフを構築するための中心的なオブジェクトです。
        this.ctx = null;
        this.isMuted = false; // ミュート状態
    }

    /**
     * AudioContextを初期化します。
     * 多くのブラウザでは、ユーザーがページ上で何らかの操作（クリックなど）をしないと
     * 音声の再生が許可されません。そのため、ゲーム開始のボタンが押されたタイミングで
     * このメソッドを呼び出すのが一般的です。
     */
    init() {
        // AudioContextがまだ作成されていない場合のみ作成します。
        if (!this.ctx) {
            // `window.AudioContext` は標準のAPI、`window.webkitAudioContext` は古いSafari用の互換APIです。
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    /**
     * 指定されたパラメータで単一のトーン（音）を再生します。
     * @param {number} freq - 周波数 (Hz)。音の高さを決めます。
     * @param {string} type - 波形の種類 ('sine', 'square', 'sawtooth', 'triangle')。音色を決めます。
     * @param {number} duration - 音の長さ
     * @param {number} [vol=0.1] - ボリューム
     */
    playTone(freq, type, duration, vol = 0.1) {
        if (this.isMuted || !this.ctx) return; // ミュート中、またはAudioContextが初期化されていない場合は何もしない。

        try {
            // 1. オシレーターを作成し、音の源となる波形を生成する
            const osc = this.ctx.createOscillator();
            // 2. ゲインを作成し、音量の制御をする
            const gain = this.ctx.createGain();

            // オシレーターの設定
            osc.type = type; // 波形タイプ
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime); // 周波数（音の高さ）

            // ゲイン（音量）の設定
            gain.gain.setValueAtTime(vol, this.ctx.currentTime); // 開始時の音量
            // 指定したdurationをかけて、音量を指数関数的に0.01まで下げる（フェードアウト効果）。
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            // 3. ノードを接続し、音声処理のパイプラインを作成する
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            // 4. 再生と停止のスケジュール
            osc.start(); // すぐに再生を開始
            osc.stop(this.ctx.currentTime + duration); // duration秒後に再生を停止
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    // ゲームイベントに対応する効果音
    playMove() { this.playTone(300, 'square', 0.05, 0.05); } // ミノが左右に移動したとき
    playRotate() { this.playTone(400, 'triangle', 0.05, 0.05); } // ミノが回転したとき
    playDrop() { this.playTone(150, 'sawtooth', 0.1, 0.1); } // ハードドロップしたとき
    playLock() { this.playTone(200, 'square', 0.1, 0.1); } // ミノがロック（固定）されたとき
    playClear() {
        this.playTone(600, 'sine', 0.1, 0.1);
        // 100ミリ秒後にもう一つ高い音を鳴らして、キラキラした感じを出す
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 100);
    }

    // ゲームオーバーの音
    playGameOver() {
        if (this.isMuted || !this.ctx) return; // ミュート中、またはAudioContextが初期化されていない場合は何もしない
        this.playTone(150, 'sawtooth', 0.5, 0.2);
        setTimeout(() => this.playTone(100, 'sawtooth', 1.0, 0.2), 400);
    }
}
