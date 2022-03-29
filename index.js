const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

/* import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, breakByTwoParts, stressPosition } from './lib/utils.js' */
import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, breakByTwoParts, getStress } from './lib/utils.js'
import { getTerms, getFlexes, getSegments, getPrefs } from './lib/remote.js'
import Debug from 'debug'

const d = Debug('app')
const g = Debug('dag')
const p = Debug('prefs')

// 1. вопросы: εἰσαγγέλλω
let dag

export async function anthrax(wf) {
    let chains = []
    let cwf = comb(wf).toLowerCase()
    let termcdicts = await getTerms(cwf)
    let tchains =  [[{cdicts: termcdicts}]]
    if (termcdicts) chains.push(...tchains)

    let dchains = await anthraxChains(wf)
    if (dchains) chains.push(...dchains)
    return chains
}

export async function anthraxChains(wf) {
    dag = new Map();
    dag.chains = []
    /* dag.cache = {} */
    dag.cwf = comb(wf)
    let flakes = scrape(dag.cwf).reverse()
    /* d('_flakes', flakes) */
    if (!flakes.length) return
    dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)
    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    dag.tail = dag.pcwf
    d('_pcwf', dag.pcwf)

    dag.prefs = []
    await findPref(dag, dag.pcwf)
    g('_dag.prefs', dag.prefs)

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
    dag.stress = getStress(dag.cwf)

    d(dag)
    // breaks - [head, tail, fls]
    let breaks = makeBreaks(dag)
    /* log('_breaks', breaks) */

    let headkeys = _.uniq(breaks.map(br=> br.head))
    /* log('_headkeys', headkeys) */
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    /* log('_tailkeys', tailkeys) */
    let keys = _.compact(headkeys.concat(tailkeys))
    /* log('_keys', keys.length) */
    let ddicts = await getSegments(keys)
    /* log('_ddicts', ddicts) */
    /* log('_ddicts', ddicts[0].docs) */
    dag.ddictids = ddicts.map(ddict=> ddict._id)
    g('_ddictids', dag.ddictids)

    let chains = makeChains(breaks, ddicts)
    /* log('_chains', chains) */

    if (dag.prefs.length) chains = chains.map(chain=> dag.prefs.concat(chain))
    return chains
}

function makeChains(breaks, ddicts) {
    let ddictids = ddicts.map(ddict=> ddict._id)
    /* log('_ddictids_', ddictids) */
    /* log('_breaks', breaks) */

    let chains = []
    for (let br of breaks) {
        /* log('_BREAK aug:', dag.aug, '_h:', br.head, '_t:', br.tail, '_term:', br.fls._id) */
        let dhead = ddicts.find(ddict=> ddict._id == br.head)
        if (!dhead) continue
        /* if (br.head.length < 3) continue // FC can not be short */
        let heads = dhead.docs
        log('_heads', br.head, br.tail, heads.length)

        if (!heads.length) continue

        if (dag.prefs) {
            let connect = dag.prefs[dag.prefs.length-1]
            if (connect && connect.vowel) heads = heads.filter(dict=> aug2vow(connect.plain, dict.aug))
        }

        log('_dag.aug', br.head, dag.aug)

        /* if (dag.aug) { */
            /* heads = heads.filter(dict=> dict.aug == dag.aug) */
        /* } */

        log('___heads_2', br.head, br.tail, heads.length)

        let chain = []
        let dictfls = []
        if (br.tail) {
            let dtail = ddicts.find(ddict=> ddict._id == br.tail)
            if (!dtail) continue
            let tails = dtail.docs
            chain.push({plain: br.head, cdicts: heads})
            if (br.vow) {
                /* log('____________________B', br.head, br.vow, br.tail, br.fls._id) */
                chain.push({plain: br.vow, vowel: true})
                tails = tails.filter(dict=> aug2vow(br.vow, dict.aug))
            } else {
                tails = tails.filter(dict=> !dict.aug)
            }
            // компаунды временно отрубил для simple тестов
            /* dictfls = dict2flex(tails, br.fls.docs, true) */
            if (!dictfls.length) continue
            /* log('________________tail+fls', br.head, br.tail, br.fls._id, 'fls', dictfls.length) */
            chain.push({plain: br.tail, cdicts: dictfls, flex:br.fls._id, cmp: true})
        } else {
            log('_no_tail_', br.head, heads.length, br.fls.docs.length)
            dictfls = dict2flex(heads, br.fls.docs, dag)
            if (!dictfls.length) continue
            /* log('___SIMPLE:', br.head, 'heads.length', heads.length, 'tail', br.tail, br.fls._id, 'fls', br.fls.docs.length, dictfls.length) */
            chain.push({plain: br.head, cdicts: dictfls, flex: br.fls._id})
        }
        if (dictfls.length) chains.push(chain)
    }
    return chains
}

// ================================================= FILTERS ==============

/*
   filter: пока бардак. simple работает, но prefs и compounds все ломают в лапшу. Нужна общая схема

*/

function dict2flex(dicts, fls, dag) {
    /* log('__DAG.CWF', dag.cwf, dag.aug, dag.stress) */
    let cdicts = []
    for (let cdict of dicts) {
        let dict = _.clone(cdict)
        /* log('____________________dict', dict.stem) */
        dict.fls = []
        for (let flex of fls) {
            /* if (flex.form == dag.cwf) log('_FLEX', flex) */
            /* log('_flex:', flex) */
            let ok = false
            // dag.prefs: ἀμφίβραχυς
            if (dag.prefs.length) {
                if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend)) ok = true
            } else {
                if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true
                else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
                else if (dict.part && flex.part ) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
                /* else if (compound && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
            }

            if (ok) dict.fls.push(flex)
            /* if (ok) log('_FLEX', flex) */
        }
        if (dict.fls.length) cdicts.push(dict)
    }
    /* log('____CDS', cdicts) */
    return cdicts
}

function makeBreaks(dag) {
    let breaks = []
    for (let fls of dag.flexes) {
        let pterm = plain(fls._id)
        let phead = dag.pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head) continue
            /* if (head.length < 3) continue // в компаундах FC не короткие, нов simple м.б. */
            tail = phead.slice(pos)
            /* if (tail && tail.length < 2) continue // в компаундах fc не короткие, нов simple м.б. */
            vow = tail[0] || ''
            if (vowels.includes(vow)) {
                tail = tail.slice(1)
                if (!tail) continue
                res = {head, vow, tail, fls}
            } else {
                res = {head, tail, fls}
            }
            if (tail && head.length < 3) continue // в компаундах FC не короткие, нов simple м.б.
            breaks.push(res)
        }
    }
    return breaks
}

// ἀντιπαραγράφω, προσαπαγγέλλω, ἐπεξήγησις
// πολύτροπος, ψευδολόγος, εὐχαριστία
// προσαναμιμνήσκω, προσδιαιρέω = без vow
// παραγγέλλω = vow
// ἀμφίβραχυς - adj

export async function findPref(dag, pcwf) {
    /* let flakes = scrape(pcwf).reverse() */
    p('____________find_pref:', pcwf)
    /* let headkeys = flakes.map(flake=> plain(flake.head)).filter(head=> head.length < 5) */
    let headkeys = dag.flakes.map(flake=> flake.head).filter(head=> head.length < 5)
    p('_headkeys', headkeys)
    let prefs = await getPrefs(headkeys)
    /* p('_prefs', pcwf, prefs) */
    if (!prefs.length) return
    let pref = _.maxBy(prefs, function(pref) { return pref.term.length; });
    pref.plain = plain(pref.term)

    /* dag.prefs.push(pref) */
    dag.prefs.push({plain: pref.plain, cdicts: [pref], pref: true})
    p('_DAG.prefs', dag.prefs)

    let tail = pcwf.replace(pref.plain, '')
    p('_TAIL', tail)
    /* let nextpref = await findPref(dag, tail) */
    /* if (nextpref) return */

    let vowel = tail[0]
    tail = tail.slice(1)
    if (!tail) return
    p('_vowel', vowel)
    if (!vowels.includes(vowel)) return
    let vow = {plain: vowel, vowel: true, pref: true}
    dag.prefs.push(vow)
    /* await findPref(dag, tail) */

}
