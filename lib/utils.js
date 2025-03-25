//

const log = console.log
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'
import { preflist } from './prefix/preflist.js'


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

export const acs = _.values(accents)

export const AllStresses = {
    'oxia': '\u0301',
    'peris': '\u0342',
    'varia': '\u0300',
    'varia_': '\u0060',
}

export const stresses = [accents.oxia, accents.peris]

let badVeryBad = '\u035c' // COMBINING DOUBLE BREVE BELOW
let badVeryBad0306 = '\u0306' // Combining Breve[1]
let wtfBad = '­'

export function cleanString(str) {
    str = cleanStress(str)
    str = cleanLongShort(str)
    str = str.replace(/\.$/, '')
    str = str.replace(/­/g, '')
    return str
}

function cleanStress(text) {
    text = text.replace(/ϐ/g, 'β')
    text = text.replace(/·/g, '·')
    text = text.replace(/ό/g, 'ό')
    text = text.replace(/ί/g, 'ί')
    text = text.replace(/ά/g, 'ά')
    text = text.replace(/ή/g, 'ή')
    text = text.replace(/ώ/g, 'ώ')
    text = text.replace(/έ/g, 'έ')
    text = text.replace(/ύ/g, 'ύ')
    text = text.trim().replace(/\.$/, '')
    return text
}

function cleanLongShort(str) {
    // https://www.compart.com/en/unicode/block/U+0300
    str = str.replace(/ᾰ/gi, 'α').replace(/ᾱ/gi, 'α').replace(/ῑ/gi, 'ι').replace(/ῐ/gi, 'ι').replace(/ῠ/gi, 'υ').replace(/ῡ/gi, 'υ').replace(/ ͜/gi, '').replace(badVeryBad, '').replace(/\u0306/g, '').replace(/\u0304/g, '').replace(/\u0313\u0304/g, '\u0313')
    return str
}


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

export function checkOddStress(cwf) {
    let ok = true
    let first = 0
    let cleans = []
    let syms = cwf.split('')
    for (let sym of syms) {
        if (stresses.includes(sym) && first) continue
        if (stresses.includes(sym)) first++
        cleans.push(sym)
    }
    return cleans.join('')
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
    let aug = '', tail = aplain
    if (!vowels.includes(aplain[0])) return {aug, tail}
    for (let asp of asps) {
    let parts = aplain.split(asp)
        if (parts.length == 2) aug = parts[0] + asp, tail = parts[1]
    }
    if (tail[0] == ypo) aug += ypo, tail = tail.slice(1)
    return {aug, tail}
}

export function parseAug_ (aplain) {
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
        log('_________________AUG', aplain, 1, first, 2, second, 3, third, '_aug:', aug)
    }
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


export function prettyIndecl(chain) {
    let vmorphs = []
    for (let cdict of chain.cdicts) {
        let morphs = ''
        if (cdict.fls) {
            let morphs = prettyName(cdict.fls)
            vmorphs.push(...morphs)
        } else if (cdict.adv) {
            let advmorph = ['adverb', cdict.atype].join('.')
            vmorphs.push(advmorph)
        // } else if (cdict.verb) {
        } else if (cdict.tense) {
            if (cdict.inf) {
                morphs = cdict.tense
            } else {
                cdict.numper = [cdict.number, cdict.person].join('.')
                morphs = [cdict.tense, cdict.numper].join(', ')
            }
            vmorphs.push(morphs)
        } else {
            // true indecl
            // log('______________________________________________', cdict)
        }
    }
    return _.uniq(vmorphs).sort()
}

export function prettyFLS(chain) {
    let morphs = []
    if (chain.name) morphs = prettyName(chain.cfls)
    else if (chain.verb) morphs = prettyVerb(chain.cfls)
    return morphs
}

export function prettyName(fls) {
    let morphs = []
    let names = fls.filter(flex=> !flex.adverb)
    let advs = fls.filter(flex=> flex.adverb)
    names = names.map(flex=> {
        return  _.compact([flex.gend, flex.number, flex.case]).join('.')
    })

    morphs.push(...names)
    advs = advs.map(flex=> {
        return ['adv', flex.atype].join('.')
    })
    morphs.push(...advs)
    return _.uniq(morphs).sort()
}

export function prettyVerb(fls) {
    let morphs = fls.map(flex=> {
        // log('_prettyVerb Flex', flex)
        let morph
        // if (flex.part) str =[ [flex.tense, flex.numper].join('.'),  [flex.gend, 'sg.nom'].join('.') ].join(', ')
        if (flex.part) {
            // log('_V Part', flex)
            if (flex.adverb) {
                let adv = ['adv', flex.atype].join('.')
                morph = [flex.tense, adv].join(', ')
            } else {
                let gendnumcase = [flex.gend, flex.number, flex.case].join('.')
                morph = [flex.tense, gendnumcase].join(', ')
            }
        }
        else if (flex.inf) {
            // log('_INF ', flex.tense)
            morph = flex.tense
        }
        else morph = [flex.tense, flex.numper].join(', ').trim()
        return morph
    })
    return _.uniq(morphs).sort()
}

// copy from dicutils/index.js
export function guessPrefix(rdict, nsize) {
    let pdict = plain(comb(rdict))
    let pref = ''
    let pstr = ''
    let psize = 1
    for (let prefstr of preflist) {
        let cpref = prefstr.replace(/-/g, '')
        let repref = new RegExp('^' + cpref)
        if (!repref.test(pdict)) continue
        let testpsize = prefstr.split('-').length
        if (nsize && testpsize != nsize) continue
        // log('_========================================== NS', nsize)

        if (cpref.length > pref.length) {
            pref = cpref
            psize = prefstr.split('-').length
            pstr = prefstr
        }
    }
    log('_========================================== NS', rdict, nsize)


    if (!pref) return

    // log('_===========================================guess prefix', prefixes)
    let repref = new RegExp('^' + pref)
    let psc = pdict.replace(repref, '')

    if (!psc) {
        return
    }

    // log('_===========================================guess prefix', pref, psc)

    let pfc = pref
    let short = removeVowelBeg(psc)
    let reshort = new RegExp(short + '$')
    let con = psc.replace(reshort, '')

    // ὑπερῷος - con - ῳο, stem
    // это не коннектор, потому что гласная долгая? Гипотеза: долгие гласные в коннекторе могут быть в производных, но не словарных формах
    let longs = ['ω']
    let confirst = con[0]
    if (con && longs.includes(confirst)) con = null

    if (con) pfc = pref + con

    // log('_============= pfc', pfc, con)

    let prefix = {pref, pfc, psize, pstr} // , guess: true
    if (con) prefix.con = con
    return prefix
}

export function removeVowelBeg(wf) {
    let beg = wf[0]
    while (beg) {
        if (vowels.includes(beg) || acs.includes(beg)) {
            wf = wf.slice(1)
            beg = wf[0]
        } else {
            beg = false
        }
    }
    return wf
}
