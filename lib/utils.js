//

const log = console.log
import _  from 'lodash'

export const accents = {
    'oxia': '\u0301',
    'varia_': '\u0060',
    'varia': '\u0300',
    'peris': '\u0342',
    '': '',
    'psili': '\u0313',
    'dasia': '\u0314',
    '': '',
    // 'ypo': '\u0345',
    '': ''
}

export function scrape (str) {
    let total = str.length+1
    let flakes = []
    let head = str
    let pos = str.length
    let beg, tail
    while (pos > 0) {
        pos--
        tail = str.slice(pos)
        head = str.substr(0, pos)
        if (!head) continue
        beg = tail[0]
        if (_.values(accents).includes(beg)) continue
        let res = {head: head, tail: tail}
        flakes.push(res)
    }
    return flakes
}
