//

const log = console.log
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

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

export const stresses = {
    'oxia': '\u0301',
    'peris': '\u0342',
    'varia': '\u0300',
    'varia_': '\u0060',
}

export const stresses_ = [accents.oxia, accents.peris]

export const vowels =  ['α', 'ε', 'ι', 'ο', 'ω', 'η', 'υ', 'ͅ'] // ypo last

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
    let aug = ''
    if (vowels.includes(pfirst)) {
        let second = aplain[1]
        let third = aplain[2]
        if (uisyms.includes(second)) aug = aplain.slice(0,3) // i.e. aspiration
        else if (third == ypo) aug = aplain.slice(0,3)        /* todo: нужно оставить ypo в plain, да, как в Dicts/wkt.js  ? */
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
    'α': ['α', 'η'],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
}

export function aug2vow(aug, vow) {
    let ok = false
    if (aug) aug = strip(aug) // if prefix
    if (vow) vow = strip(vow)
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
        // if (_.values(accents).includes(beg)) continue // в словаре wkt flex.term может начинаться на ударение. похоже, это нормально
        // почему-то я от этого отказался раньше
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
            res = {head, tail}
            brkey = tail
        }
        if (brkeys[brkey]) continue
        brkeys[brkey] = true
        breaks.push(res)
    }
    return breaks
}

export function getStress(form) {
    let idx, nth, syls, stress, stressObj
    for (stress in stresses) {
        idx = form.indexOf(stresses[stress])
        if (idx > -1) {
            nth = getSyllables(form.slice(0, idx))
            syls = getSyllables(form)
            stressObj = {pos: idx, stress, nth, syls}
            return stressObj
        }
    }
    return {pos: 0, type: null}
}

function getSyllables(form) {
    let syms = form.split('')
    let sym, vows = []
    for (sym of syms) {
        if (vowels.includes(sym)) vows.push(sym)
    }
    return vows.length
}

export function prettyVerbRes(chain) {
    let prettyres = {}
    prettyres.segs = chain.map(seg=> seg.seg).join('-')
    let head = chain.find(seg=> seg.head)
    if (head) prettyres.head = head.seg
    prettyres.pref = ''
    let cdict = chain.slice(-2)[0].cdict
    prettyres.rdict = cdict.rdict
    if (cdict.pref) prettyres.dictpref = cdict.pref
    else if (chain[0].pref) {
        let prefdict = chain.slice(0)[0].cdicts[0]
        prettyres.pref = prefdict.term
    }
    prettyres.stem = cdict.stem
    let flsseg = chain.slice(-1)[0]
    // log('_FLS', flsseg.fls)
    if (cdict.verb) prettyres.fls = prettyVerbFLS(flsseg.fls)
    if (cdict.name) prettyres.fls = prettyNameFLS(flsseg.fls)
    prettyres.fls = JSON.stringify(prettyres.fls.sort())
    // prettyres.trns = cdict.trns[0]
    if (!prettyres.pref) delete prettyres.pref
    return prettyres
}

function prettyVerbFLS(fls) {
    return fls.map(flex=> {
        let str
        // if (flex.part) str =[ [flex.tense, flex.numper].join('.'),  [flex.gend, 'sg.nom'].join('.') ].join(', ')
        if (flex.part) str = [flex.tense,  [flex.gend, flex.numcase].join('.') ].join(', ')
        else str =[flex.tense, flex.numper].join(' ')
        return str
    })
}

function prettyNameFLS(fls) {
    return fls.map(flex=> {
        return  [flex.gend, flex.numcase].join('.')
    })
}
