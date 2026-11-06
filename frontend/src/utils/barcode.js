const patterns = {
    '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
    '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
    A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
    G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
    M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
    S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
    Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
    $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

/**
 * Encode a sale ID as Code 39 bars. The value is wrapped in start/stop characters.
 * @param {string} input
 * @returns {{ bars: Array<{ x: number, width: number }>, width: number, value: string }}
 */
export function getCode39Bars(input) {
    const clean = String(input || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '') || 'RETAILTRACK';
    const encoded = `*${clean}*`;
    const bars = [];
    let x = 0;
    for (const character of encoded) {
        const pattern = patterns[/** @type {keyof typeof patterns} */ (character)];
        for (let index = 0; index < pattern.length; index += 1) {
            const width = pattern[index] === 'w' ? 3 : 1;
            if (index % 2 === 0) bars.push({x, width});
            x += width;
        }
        x += 1;
    }
    return {bars, width: x - 1, value: clean};
}