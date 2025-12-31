const PIECES_DEF = {
    'I': [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    'J': [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
    'L': [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
    'O': [[4, 4], [4, 4]],
    'S': [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    'T': [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
    'Z': [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
};
const TYPE_TO_COLOR = { 'I': 1, 'J': 2, 'L': 3, 'O': 4, 'S': 5, 'T': 6, 'Z': 7 };

class PieceGenerator {
    constructor() {
        this.bag = [];
    }

    _refill() {
        const types = 'ILJOTSZ'.split('');
        // Simple shuffle
        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }
        this.bag = types;
    }

    next() {
        if (this.bag.length === 0) this._refill();
        const type = this.bag.pop();
        return {
            matrix: PIECES_DEF[type].map(row => [...row]),
            colorId: TYPE_TO_COLOR[type],
            type: type,
            x: 0,
            y: 0
        };
    }
}
