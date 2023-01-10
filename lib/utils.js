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

export const AllStresses = {
    'oxia': '\u0301',
    'peris': '\u0342',
    'varia': '\u0300',
    'varia_': '\u0060',
}

export const stresses = [accents.oxia, accents.peris]

export function getStress(form) {
    let idx, stressidx, stress
    for (let strs in AllStresses) {
        idx = form.lastIndexOf(AllStresses[strs])
        if (idx < 0) continue
        stressidx = form.length - idx
        stress = strs
    }
    return {stressidx, stress}
}


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
    let first = aplain[0]
    let aug = ''
    if (vowels.includes(first)) {
        let second = aplain[1]
        let third = aplain[2]
        if (asps.includes(third)) aug = aplain.slice(0,3)  // i.e. aspiration
        else if (third == ypo) aug = aplain.slice(0,3)
        else if (asps.includes(second)) aug = aplain.slice(0,2) //
        else if (uisyms.includes(second)) aug = aplain.slice(0,2)
        else aug = aplain.slice(0,1)
        // FAIL ᾄδω - ᾖσθα - не уничтожается perispomenon - ᾖσθαι
        // if (aplain == 'εισφορ') log('_________________ AUG:', aplain, first, second, 'AUG', aug)
    }
    // log('_________________AUG', aplain, first, second, ':', aug)
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

export function getStress_old(form) {
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


export function prettyIndecl(indecl) {
    let vmorphs = []
    for (let cdict of indecl.cdicts) {
        let morphs = ''
        if (cdict.fls) {
            let morphs = prettyName(cdict.fls)
            vmorphs.push(...morphs)
        } else if (cdict.adv) {
            let advmorph = ['adverb', cdict.atype].join('.')
            vmorphs.push(advmorph)
            // log('_indecl:', cdict.term, morphs)
        }
    }
    return _.uniq(vmorphs).sort()
}

export function prettyFLS(chain) {
    let mseg = chain.find(seg=> seg.mainseg)
    let fls = chain.find(seg=> seg.fls).fls
    let morphs = ''
    if (mseg.name) morphs = prettyName(fls)
    else if (mseg.verb) morphs = prettyVerb(fls)
    return morphs
}

export function prettyName(fls) {
    let morphs = []
    let names = fls.filter(flex=> !flex.adv)
    let advs = fls.filter(flex=> flex.adv)
    names = names.map(flex=> {
        return  [flex.gend, flex.numcase].join('.')
    })
    morphs.push(...names)
    advs = advs.map(flex=> {
        return ['adverb', flex.atype].join('.')
    })
    morphs.push(...advs)
    return _.uniq(morphs).sort()
}

export function prettyVerb(fls) {
    let morphs = fls.map(flex=> {
        let str
        // if (flex.part) str =[ [flex.tense, flex.numper].join('.'),  [flex.gend, 'sg.nom'].join('.') ].join(', ')
        if (flex.part) str = [flex.tense,  [flex.gend, flex.numcase].join('.') ].join(', ')
        else if (flex.inf) str = flex.tense
        else str = [flex.tense, flex.numper].join(', ').trim()
        return str
    })
    return _.uniq(morphs).sort()
}
