const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels, parseAug, vnTerms, aug2vow } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
import { filter, simple } from './lib/filters.js'
import Debug from 'debug'

// 1. вопросы: εἰσαγγέλλω - два одинаковых sgms, ἐξαγγέλλω - то же
// 2. wkt_names - чистый stripped, плюс aug, но не как в vebs, не отдельным сегментом, а для доп. проверки
// а здесь нужен level, и проверять name aug только в начале chain - жуть
// или, для однообразия, вычислять aug-names как в verbs?
// 3. почему я здесь получаю eimi, все варианты, если eimi есть в terms?

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
    return dag.chains
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
            /* if (chain) dag.chains.push(chain) */
            if (!chain)  {
                let head
                let prefixes = ddict.docs.filter(dict=> dict.prefix)
                if (prefixes.length) {
                    head = {plain: ddict._id, dicts: prefixes}
                } else if (ddict._id.length > 1 && ddict.docs.length) {
                    head = {plain: ddict._id, dicts: ddict.docs}
                }
                if (head) heads.push(head)
            }
        } else {
            g('__ELSE', headstr, ddict._id)
            let vowel = heads.slice(-1)[0].plain
            ddict.docs = ddict.docs.filter(dict=> aug2vow(vowel, dict.aug))
            let chain = dict2flex(heads, ddict)
            /* if (ddict._id == 'τον') log('_CHAIN', ddict._id, chain) */
            /* if (chain) dag.chains.push(chain) */
        }

        if (!nexttail) continue
        await dagging(heads, nexttail)

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
                if (dict.name && flex.name && dict.key == flex.key) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(verbkey=> flex.key == verbkey.key)) ok = true
                else if (headstr && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds
                if (ok) {
                    if (!dict.flexes) dict.flexes = []
                    dict.flexes.push(flex)
                }
            }
        }
        if (dict.flexes) cdicts.push(dict)
    }
    /* dag.cache[ddict._id] = cdicts */
    return cdicts
}
