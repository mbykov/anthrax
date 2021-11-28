const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels, parseAug, vnTerms } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
import { filter, simple } from './lib/filters.js'
import Debug from 'debug'

// 1. вопросы: εἰσαγγέλλω - два одинаковых sgms, ἐξαγγέλλω - то же
// 2. wkt_names - чистый stripped, плюс aug, но не как в vebs, не отдельным сегментом, а для доп. проверки
// а здесь нужен level, и проверять name aug только в начале chain - жуть
// или, для однообразия, вычислять aug-names как в verbs?
// 3. почему я здесь получаю eimi, все варианты, если eimi есть в terms?

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
/* let chains = [] */
/* let pcwf = '' */
/* let flexes */
let dag = new Map();
dag.chains = []

const d = Debug('app')
const h = Debug('head')
const g = Debug('dag')
const m = Debug('more')

/* anthrax(wordform) */

export async function anthrax (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    d('_flakes', flakes)
    if (!flakes.length) return
    let tails = flakes.map(flake=> flake.tail)
    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(cwf)
    d('_pcwf', dag.pcwf)
    let aug = parseAug(dag.pcwf)
    if (aug) {
        dag.aug = aug
        dag.pcwf = dag.pcwf.substr(aug.length)
    }
    await dagging([], dag.pcwf)
    log('_raw chains_:', dag.chains)
}

// ἀγαθοποιέω, βαρύτονος, ἄβακος, βαρύς, τόνος, καθαρισμός, ἀγαθός
// βούκερας

async function getDicts(tail) {
    let flakes = scrape(tail)
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let ddicts = await getSegments(headkeys)
    // todo: return ddicts
    let dictids = ddicts.map(dict=> dict._id)
    m('_dictids_', dictids, 'aug:', dag.aug, 'tail:', tail)
    return ddicts
}

async function dagging(oldheads, tail) {
    let ddicts = await getDicts(tail)
    if (!ddicts.length) return
    let headstr = oldheads.map(doc=> doc._id).join('')
    g('_headstr_', oldheads.length, headstr, '_tail_', tail)

    for (let ddict of ddicts) {
        let nexttail = tailBySyze(ddict, tail)
        g('___ddict_start:', ddict._id)
        let heads = _.clone(oldheads)
        if (heads.length == 0) {
            let chain = dict2flex('', ddict, dag.flexes)
            if (chain) dag.chains.push(chain)
            if (nexttail) heads.push({_id: ddict._id, docs: ddict.docs})
        }  else if (heads.length == 1) {
            let chain = dict2flex(headstr, ddict, dag.flexes)
            chain.unshift(...heads)
            if (chain) dag.chains.push(chain)
            if (nexttail) heads.push({_id: ddict._id, docs: ddict.docs})
        } else {
            m('__ELSE', headstr, ddict._id)
            let dicts = dict2plain(heads, ddict, dag.flexes)
        }

        if (!nexttail) continue
        let pdict = plain(ddict._id)

        let vowel = nexttail[0]
        g('_========pdict_1', pdict, 'vow:', vowel, '_nexttail:', nexttail)
        if (!vowels.includes(vowel)) continue
        pdict = pdict + vowel
        nexttail = nexttail.substr(vowel.length)
        /* g('_pdict_vow', pdict, '_nexttail', nexttail) */
        if (nexttail == tail) continue
        /* if (pdict != 'παχυ') continue */
        heads.push({_id: vowel, vowel: true})
        let xxx = heads.map(doc=> doc._id).join('-')
        g('_========pdict_2', pdict, 'vow:', vowel, '_nexttail:', nexttail, 'headstr:', xxx)
        await dagging(heads, nexttail)

    } // ddicts
}

function tailBySyze(ddict, tail) {
    let pdict = plain(ddict._id)
    let nexttail = tail.substr(pdict.length)
    if (nexttail == tail) nexttail = null
    else if (dag.flexids.includes(nexttail)) nexttail = null
    return nexttail
}

function dict2flex(headstr, ddict, flexes) {
    for (let doc of ddict.docs) {
        let cflexes = []
        let flexid
        for (let flex of flexes) {
            if (dag.pcwf != headstr + ddict._id + plain(flex._id)) continue
            flexid = flex._id
            for (let flexdoc of flex.docs) {
                if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
            }
        }
        if (cflexes.length) {
            let chain = [{dict: doc.plain, doc, flex: flexid, flexes: cflexes}]
            return chain
        }
    }
}



function dict2plain(heads, ddict, flexes) {
    let headstr = heads.map(doc=> doc._id).join('')
    m('____________inner headstr', headstr)
    let dicts = []
    let vowel = (heads.slice(-1)[0].vowel) ? heads.slice(-1)[0]._id : null
    let cflexes = flexes = flexes.filter(flex=> dag.pcwf == headstr + ddict._id + plain(flex._id))
    for (let dict of ddict.docs) {
        for (let cflex of cflexes) {
            for (let flex of cflex.docs) {
                let ok = false
                if (dict.name && flex.name && dict.key == flex.key) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(verbkey=> flex.key == verbkey.key)) ok = true
                else if (heads.length && dict.verb && flex.verb && vnTerms.includes(flex.key)) ok = true // heads.length - compounds
                if (ok) {
                    if (!dict.flexes) dict.flexes = []
                    dict.flexes.push(flex)
                }
            }
        }
        if (dict.flexes) dicts.push(dict)
    }
    if (dicts.length) {
        /* m('___else pushed', ddict._id, '_vow:', vowel, '_aug:', dict.aug) */
        m('___else pushed', ddict._id, '_vow:', vowel)
        let chain = [{dict: ddict._id, dicts}]
        if (heads.length) chain.unshift(...heads)
        dag.chains.push(chain)
    }
    return dicts
}
