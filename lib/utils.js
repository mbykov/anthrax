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

export const vowels =  ['α', 'ε', 'ι', 'ο', 'ω', 'η', 'υ']

export const ypo = '\u0345'

export const aspirations = {
    'psili': '\u0313',
    'dasia': '\u0314'
}

export const asps = ['\u0313', '\u0314']

export const uisyms = ['υ', 'ι']

/* const asps = _.values(aspirations) */

export function parseAug (aplain) {
    let pfirst = aplain[0]
    let second = aplain[1]
    // let third = aplain[2]
    let aug
    if (vowels.includes(pfirst)) {
        if (uisyms.includes(second)) aug = aplain.slice(0,3) // i.e. aspiration
        // else if (third == ypo) aug = aplain.slice(0,3)
        // todo: нужно оставить ypo в plain ?
        else if (asps.includes(second)) aug = aplain.slice(0,2) //
        else aug = aplain.slice(0,1)
        // FAIL ᾄδω - ᾖσθα - не уничтожается perispomenon - ᾖσθαι
    }
    // if (aplain == 'ε') log('_________________ AUG:', aplain, 'AUG', aug)
    // log('_________________AUG', aplain, pfirst, second, ':', aug)
    return aug
}

// verb 2 name terms
export const vnTerms = ['ος', 'ής', 'της', 'τηρ', 'τωρ']

export const augs_ = ['ἀ', 'αἰ', 'ἁ', 'ἐ', 'ἠ', 'ἰ', 'ὀ', 'ῥ', 'υἱ', 'ὠ', '']
let augs = ['ἀ', 'ἐ', 'ἠ', 'εἰ', 'ἑ', 'ἰ', 'ὠ', 'ἁ', 'ἡ', 'αἰ', 'αἱ', 'εἱ', 'εὐ', 'αὐ', 'ηὐ', 'εὑ', 'ηὑ', 'ἱ', 'ὀ', 'οἰ', 'ω', 'ὁ', 'ὡ', 'ὑ']
let augplains = ['α', 'ε', 'η', 'ει', 'ι', 'ω', 'αι', 'ευ', 'αυ', 'ηυ', 'ο', 'οι', 'υ']

const vaugs = {
    'ἀ': ['α', 'η'],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
}

// здесь нет префиксов:
export function aug2vow(vow, aug) {
    let ok = false
    /* if (vow == 'ο' && !aug) ok = true */
    if (vow && !aug) ok = true
    else if (!vow && aug) ok = false
    else if (vow == aug) ok = true
    else if (vaugs[aug] && vaugs[aug].includes(vow)) ok = true
    return ok
}

export function scrape (str) {
    /* let total = str.length+1 */
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

// граница - согласная
export function breakByTwoParts (breaks, str) {
    const brkeys = {}
    let head = str
    let pos = str.length
    let vow, tail, res, brkey
    while (pos > 0) {
        pos--
        tail = str.slice(pos)
        head = str.substr(0, pos)
        if (!head) continue
        vow = tail[0]
        if (vowels.includes(vow)) {
            tail = tail.slice(1)
            if (!tail) continue
            res = {head, vow, tail}
            brkey = [vow, tail].join('')
        } else {
            res = {head: head, tail: tail}
            brkey = tail
        }
        if (brkeys[brkey]) continue
        brkeys[brkey] = true
        breaks.push(res)
    }
    return breaks
}
