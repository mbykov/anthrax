const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels, parseAug, vnTerms, aug2vow, breakByTwoParts } from './lib/utils.js'
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

    // это потом, после prefs:
    /* let aug = parseAug(dag.pcwf)
     * if (aug) {
     *     dag.aug = aug
     *     dag.pcwf = dag.pcwf.substr(aug.length)
     * } */
    dag.prefs = []
    let pref = await findPref(dag, dag.pcwf)

    log('_PREFS', dag.prefs.map(pref=> pref.plain))
    let prefstr = dag.prefs.map(pref=> pref.plain).join('')
    let tail = dag.pcwf.replace(prefstr, '')
    let prefstr_ = dag.prefs.map(pref=> pref.plain).join('-')
    log('_TAIL___', dag.cwf, '=', prefstr_, '+', tail)

    return dag.chains
    let breaks = makeBreaks(dag)
    log('_breaks', breaks)
    let headkeys = _.uniq(breaks.map(br=> br.head))
    /* log('_headkeys', headkeys) */
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    /* log('_tailkeys', tailkeys) */
    let keys = headkeys.concat(tailkeys)
    /* log('_keys', keys) */
    let ddicts = await getSegments(keys)
    let chains = compactBreaks(breaks, ddicts)

    return dag.chains
}

// ἀντιπαραγράφω, προσαπαγγέλλω, ἐπεξήγησις
// πολύτροπος, ψευδολόγος, εὐχαριστία
// bug  - ἐπεξήγησις - находит ap, а нужно ep - longest туп
// προσαναμιμνήσκω, προσδιαιρέω = без vow
// παραγγέλλω = vow
async function findPref(dag, cwf) {
    let flakes = scrape(cwf).reverse()
    /* log('_flakes', flakes) */
    // === PLAIN ===
    let headkeys = flakes.map(flake=> plain(flake.head)).filter(head=> head.length < 5)
    /* let headkeys = flakes.map(flake=> flake.head).filter(head=> head.length < 5) */
    log('_headkeys', headkeys)
    let ddicts = await getSegments(headkeys)
    log('_ddicts', ddicts.length)
    let cpref, prefs = []
    for (let ddict of ddicts) {
        if (!ddict.docs) log('_NO DOCS_', cwf, ddict, headkeys, flakes)
        cpref = ddict.docs.find(dict=> dict.pref)
        if (cpref) prefs.push(cpref)
    }
    /* log('_PREFS', prefs) */
    if (!prefs.length) return
    let pref = _.maxBy(prefs, function(pref) { return pref.plain.length; });

    dag.prefs.push(pref)

    let tail = cwf.replace(pref.plain, '')
    log('_TAIL', tail)
    let nextpref = await findPref(dag, tail)
    log('_nextpref', nextpref)
    if (nextpref) return

    let vowel = tail[0]
    tail = tail.slice(1)
    if (!tail) return
    log('_vowel', vowel)
    if (!vowels.includes(vowel)) return
    let vow = {plain: vowel, vowel: true}
    dag.prefs.push(vow)
    nextpref = await findPref(dag, tail)

    return pref
}

/* log('_longest', longest)
 * dag.prefs.push(longest)
 *
 * let tail = cwf.slice(longest.plain.length)
 * if (!tail) return
 *
 * tail = plain(tail)
 *
 * let vowel = tail[0]
 * if (vowels.includes(vowel)) {
 *     tail = tail.slice(1)
 *     if (!tail) return
 *     let vow = {plain: vowel, vowel: true}
 *     dag.prefs.push(vow)
 * }
 * dag.tail = tail
 * await findPref(dag, tail) */




function compactBreaks(breaks, ddicts) {
    let ddictids = ddicts.map(ddict=> ddict._id)
    log('_ddicts', ddictids)
    let chains = []
    for (let twopart of breaks) {
        if (ddictids.includes(twopart.head) && ddictids.includes(twopart.tail)) chains.push(twopart)
    }
    log('_CHAINS', chains)
}

function makeBreaks(dag) {
    let breaks = []
    for (let flex of dag.flexes) {
        let head = dag.pcwf.slice(0, - flex._id.length)
        breakByTwoParts(breaks, head)
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

function dict2flex(heads, ddict) {
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

function parseCDicts(headstr, ddict) {
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
