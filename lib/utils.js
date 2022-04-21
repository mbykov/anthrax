//

const log = console.log
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'
import { getSegments } from './remote.js'
import md5 from 'md5'

import Debug from 'debug'
const p = Debug('prefs')

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
    let aug
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
    'ἀ': ['α', 'η'],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
    '': ['', '',],
}

export function aug2vow(vow, aug) {
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
    let idx, nth, syls, keymd5, stress, stressObj
    for (stress in stresses) {
        idx = form.indexOf(stresses[stress])
        if (idx > -1) {
            nth = getSyllables(form.slice(0, idx))
            syls = getSyllables(form)
            stressObj = {pos: idx, stress, nth, syls}
            stressObj.md5 = md5(JSON.stringify(stressObj))
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

export async function findPrefs_old(dag, pcwf) {
    /* let flakes = scrape(pcwf).reverse() */
    p('____________find_pref:', pcwf)
    let headkeys = dag.flakes.map(flake=> plain(flake.head)) // .filter(head=> head.length < 6) // compound can be longer
    p('_headkeys', headkeys)
    let prefs = await getPrefs(headkeys)
    p('_prefs', pcwf, prefs)

    if (!prefs.length) return
    let pref = _.maxBy(prefs, function(pref) { return pref.term.length; });
    pref.plain = plain(pref.term)

    /* dag.prefs.push(pref) */
    dag.prefs.push({plain: pref.plain, cdicts: [pref], pref: true})
    p('_DAG.prefs', dag.prefs)

    let tail = pcwf.replace(pref.plain, '')
    p('_TAIL', tail)
    /* let nextpref = await findPrefs(dag, tail) */
    /* if (nextpref) return */

    let vowel = tail[0]
    tail = tail.slice(1)
    if (!tail) return
    p('_vowel', vowel)
    if (!vowels.includes(vowel)) return
    let vow = {plain: vowel, vowel: true, pref: true}
    dag.prefs.push(vow)
    /* await findPrefs(dag, tail) */

}
