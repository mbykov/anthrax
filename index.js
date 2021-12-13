const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels, parseAug, vnTerms, aug2vow, breakByTwoParts, findPref } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
/* import { filter, simple } from './lib/filters.js' */
import Debug from 'debug'

// 1. вопросы: εἰσαγγέλλω

let dag

const d = Debug('app')
const h = Debug('head')
const g = Debug('dag')
const m = Debug('more')

/* anthrax(wordform) */

export async function anthrax (wf) {
    dag = new Map();
    dag.chains = []
    dag.cache = {}
    dag.cwf = comb(wf)
    let flakes = scrape(dag.cwf).reverse()
    d('_flakes', flakes)
    if (!flakes.length) return
    let tails = flakes.map(flake=> flake.tail)
    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    dag.tail = dag.pcwf
    d('_pcwf', dag.pcwf)

    dag.prefs = []
    await findPref(dag, dag.pcwf)
    if (dag.prefs.length) {
        /* log('_PREFS', dag.prefs.map(pref=> pref.plain)) */
        let lastpref = _.last(dag.prefs)
        if (lastpref.vowel) dag.aug = lastpref.plain
        let prefstr = dag.prefs.map(pref=> pref.plain).join('')
        dag.pcwf = dag.pcwf.replace(prefstr, '')
        let beg = dag.pcwf[0]
        if (vowels.includes(beg)) {
            dag.pcwf = dag.pcwf.slice(1)
            lastpref.plain = lastpref.plain + beg
            dag.aug = lastpref.plain
        }
    } else {
        dag.aug = parseAug(dag.pcwf) || ''
        dag.pcwf = dag.pcwf.slice(dag.aug.length)
    }

    /*
       здесь - проверяю heads, или heads+tails
       конструирую chains: head + flex
       если нет, или param=comp:
       конструирую chains: head + tail + flex
     */
    /* log('_PREFS_', dag.prefs) */
    /* log('_dag.aug_', dag.aug) */
    let prefstr_ = dag.prefs.map(pref=> pref.plain).join('-')
    log('_TAIL_', dag.cwf, '=', prefstr_, '+', dag.pcwf)

    let breaks = makeBreaks(dag)
    /* log('_breaks', breaks) */
    breaks.forEach(br=> {
        if (!br.vow) br.vow = ''
        /* log('_br', br.head, br.vow, br.tail, br.fls._id) */
    })

    let headkeys = _.uniq(breaks.map(br=> br.head))
    /* log('_headkeys', headkeys) */
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    /* log('_tailkeys', tailkeys) */
    let keys = _.compact(headkeys.concat(tailkeys))
    /* log('_keys', keys.length) */
    let ddicts = await getSegments(keys)
    /* log('_ddicts', ddicts.length) */
    let chains = compactBreaks(breaks, ddicts)

    if (dag.prefs.length) chains = chains.map(chain=> dag.prefs.concat(chain))
    log('_chains', chains)


    return []
}

function makeBreaks(dag) {
    let breaks = []
    /* const brkeys = new Map() */
    for (let fls of dag.flexes) {
        let pterm = plain(fls._id)
        let phead = dag.pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head) continue
            /* if (head.length < 2) continue */ // в компаундах fc не короткие, нов simple м.б.
            tail = phead.slice(pos)
            vow = tail[0]
            if (vowels.includes(vow)) {
                tail = tail.slice(1)
                if (!tail) continue
                res = {head, vow, tail, fls}
            } else {
                res = {head, tail, fls}
            }
            /* if (brkeys[tail]) continue */
            /* brkeys[tail] = true */
            breaks.push(res)
        }
    }
    return breaks
}

function compactBreaks(breaks, ddicts) {
    let ddictids = ddicts.map(ddict=> ddict._id)
    /* log('_ddictids', ddictids.length) */
    let chains = []
    for (let br of breaks) {
        if (!ddictids.includes(br.head) || br.tail &&  !ddictids.includes(br.tail)) continue
        let heads = ddicts.filter(ddict=> ddict._id == br.head)
        let tails = ddicts.filter(ddict=> ddict._id == br.tail)
        let head = {plain: br.head, cdicts: heads}
        let chain = []
        let dictfls
        if (br.tail) {
            chain.push({plain: br.head, cdicts: heads})
            if (br.vow) chain.push({plain: br.vow, vowel: true})
            dictfls = dict2flex(tails, br.fls.docs)
            chain.push({plain: br.tail, cdicts: dictfls, flex:br.fls._id})
        } else {
            dictfls = dict2flex(heads, br.fls.docs)
            chain.push({plain: br.head, cdicts: dictfls, flex:br.fls._id})
        }
        /* chain.flex = br.fls._id */
        if (dictfls.length) chains.push(chain)
    }
    return chains
    log('_CHAINS', chains)
}

/* function dict2flex(headstr, ddict) { */
function dict2flex(tails, fls) {
    let cdicts = []
    for (let ddict of tails) {
        let cdict = {}
        for (let dict of ddict.docs) {
            for (let flex of fls) {
                let ok = false
                let key = plain(flex.key.split('-')[0])
                if (dict.name && dict.adj && flex.name && dict.key == flex.key) ok = true
                else if (dict.name && flex.name && dict.key == flex.key && dict.gends.includes(flex.gend)) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(verbkey=> flex.key == verbkey.key)) ok = true
                /* else if (dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
                if (ok) {
                    if (!cdict.fls) cdict.fls = []
                    cdict.fls.push(flex)
                }
            }
        }
        if (cdict.fls && cdict.fls.length) cdicts.push(cdict)
    }
    return cdicts
}






function makeBreaks_(dag) {
    const breaks = []
    for (let flex of dag.flexes) {
        let head = dag.pcwf.slice(0, - flex._id.length)
        breakByTwoParts_(breaks, head)
    }
    return breaks
}

export function breakByTwoParts_ (breaks, str) {
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


async function getDicts(tail) {
    let flakes = scrape(tail)
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let ddicts = await getSegments(headkeys)
    // todo: return ddicts
    let dictids = ddicts.map(dict=> dict._id)
    g('_dictids_', dictids, 'aug:', dag.aug, 'tail:', tail)
    return ddicts
}

function addHead(heads, ddict) {
    let head
    let prefixes = ddict.docs.filter(dict=> dict.pref)
    if (prefixes.length) {
        head = {plain: ddict._id, cdicts: prefixes, pref: true}
    } else if (ddict._id.length > 1 && ddict.docs.length) {
        head = {plain: ddict._id, cdicts: ddict.docs}
    }
    if (head) heads.push(head)
}

async function dagging(oldheads, tail) {
    let ddicts = await getDicts(tail)
    if (!ddicts.length) return
    let headstr = oldheads.map(doc=> doc.plain).join('')
    g('_headstr_', oldheads.length, headstr, '_tail_', tail)

    for (let ddict of ddicts) {
        let nexttail = tailBySize(ddict, tail)
        g('___ddict_start:', ddict._id, '_aug:', dag.aug)
        let heads = _.clone(oldheads)
        if (heads.length == 0) {
            ddict.docs = ddict.docs.filter(dict=> dict.aug == dag.aug)
            let chain = dict2flex(heads, ddict)
            if (!chain) addHead(heads, ddict)
        } else {
            g('__ELSE', headstr, ddict._id)
            let prefix = heads.slice(-1)[0].pref ? heads.slice(-1)[0].plain : null
            let vowel = heads.slice(-1)[0].vowel ? heads.slice(-1)[0].plain : null
            if (!prefix) ddict.docs = ddict.docs.filter(dict=> aug2vow(vowel, dict.aug))
            /* if (!vowel && headstr == 'δια' && ddict._id == 'γγελ') log('__DIA', headstr, '_vow:', vowel, ddict.docs.length) */
            let chain = dict2flex(heads, ddict)
            if (!chain) addHead(heads, ddict)
        }

        if (dag.chains.length) continue // todo: тут надо разобраться - вызывать по ясному требованию, клику?

        if (!nexttail) continue
        await dagging(heads, nexttail)

        if (!heads.length || heads[0].pref) continue // пока что отключаю aug после префиксов

        let pdict = plain(ddict._id)
        let vowel = nexttail[0]
        g('_========pdict_1', pdict, 'vow:', vowel, '_nexttail:', nexttail)
        if (!vowels.includes(vowel)) continue
        pdict = pdict + vowel
        nexttail = nexttail.substr(vowel.length)
        heads.push({plain: vowel, vowel: true})
        g('_========pdict_2', pdict, 'vow:', vowel, '_nexttail:', nexttail, 'headstr:', heads.length)
        await dagging(heads, nexttail)

    } // ddicts
}

function tailBySize(ddict, tail) {
    let pdict = plain(ddict._id)
    let nexttail = tail.substr(pdict.length)
    if (dag.flexids.includes(nexttail)) nexttail = null
    return nexttail
}

function dict2flex_(heads, ddict) {
    let headstr = heads.map(doc=> doc.plain).join('')
    /* let cdicts */
    /* if (dag.cache[ddict._id]) cdicts = dag.cache[ddict._id] */
    /* else cdicts = parseCDicts(headstr, ddict) */
    let cdicts = parseCDicts(headstr, ddict)
    if (!cdicts.length) return
    /* if (cdicts.length) log('____________inner headstr', headstr, '_ddict:', ddict._id, '_cdicts:', cdicts.length) */

    m('___else pushed', ddict._id)
    let chain = [{plain: ddict._id, cdicts}]
    if (heads.length) chain.unshift(...heads)
    dag.chains.push(chain)
    return chain
}

function parseCDicts_(headstr, ddict) {
    let cdicts = []
    let cflexes = dag.flexes.filter(flex=> dag.pcwf == headstr + ddict._id + plain(flex._id))
    for (let dict of ddict.docs) {
        for (let cflex of cflexes) {
            for (let flex of cflex.docs) {
                let ok = false
                let key = plain(flex.key.split('-')[0])
                if (dict.name && dict.adj && flex.name && dict.key == flex.key) ok = true
                else if (dict.name && flex.name && dict.key == flex.key && dict.gends.includes(flex.gend)) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(verbkey=> flex.key == verbkey.key)) ok = true
                else if (headstr && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds
                if (ok) {
                    if (!dict.fls) dict.fls = []
                    dict.fls.push(flex)
                }
            }
        }
        /* dict.fls = _.uniq(dict.fls) // TODO: ???? почему много в одном dict? */
        if (dict.fls && dict.fls.length) cdicts.push(dict)
    }
    /* dag.cache[ddict._id] = cdicts */
    return cdicts
}
