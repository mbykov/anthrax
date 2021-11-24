const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
import { filter, simple } from './lib/filters.js'
import Debug from 'debug'

// 1. вопросы: εἰσαγγέλλω - два одинаковых sgms, ἐξαγγέλλω - то же
// 2. wkt_names - чистый stripped, плюс aug, но не как в vebs, не отдельным сегментом, а для доп. проверки
// а здесь нужен level, и проверять name aug только в начале chain - жуть
// или, для однообразия, вычислять aug-names как в verbs?
// 3. почему я здесь получаю eimi, все варианты, если eimi есть в terms?

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let chains = []
let pcwf = ''
let flexes
let dag

const d = Debug('app')
const h = Debug('head')
const f = Debug('dag')

anthrax(wordform)

async function anthrax (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    d('_flakes', flakes)
    if (!flakes.length) return
    let tails = flakes.map(flake=> flake.tail)
    flexes = await getFlexes(tails)
    let flexstrs = flexes.map(flex=> flex._id)
    d('_flexstrs', flexstrs)
    pcwf = plain(cwf)
    d('_pcwf', pcwf)
    await dagging([], cwf)
    log('_raw chains_:', chains)

}

// ἀγαθοποιέω, βαρύτονος, ἄβακος, βαρύς, τόνος, καθαρισμός

async function getDicts(tail) {
    let flakes = scrape(tail)
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let ddicts = await getSegments(headkeys)
    let dictids = ddicts.map(dict=> dict._id)
    h('_dictids_', dictids, 'tail:', tail)
    /* let headstr = heads.map(doc=> doc._id).join('') */
    /* h('_headstr_', heads.length, headstr) */
    return ddicts
}

async function dagging(heads, tail) {
    let ddicts = await getDicts(tail)
    if (!ddicts.length) return

    let headstr = heads.map(doc=> doc._id).join('')
    log('_headstr_', heads.length, headstr, '_tail_', tail)
    h('_tail_', tail)

    for (let ddict of ddicts) {
        let dictheads = _.clone(heads)

        if (heads.length == 0) {
            let chain = dict2flex(headstr, pcwf, ddict, flexes)
            /* if (chain) chain.unshift(...dictheads) */
        } else if (heads.length == 1) {
            let aug = ddict.docs.find(doc=> doc.aug)
            let chain = dict2flex(headstr, pcwf, ddict, flexes)
            if (chain && !aug) chain.unshift(...dictheads)
            // ==> doc2flex
            // if (aug) => doc2flex без unshift
            // else => doc2plain
        } else {
            let chain = dict2flex(headstr, pcwf, ddict, flexes)
            if (dictheads.length && chain) chain.unshift(...dictheads)
            // heads - есть, > 1
            // doc2plain
            // unshift
        }


        for (let doc of ddict.docs) {
            let cflexes = []
            for (let flex of flexes) {
                if (pcwf != headstr + ddict._id + plain(flex._id)) continue
                for (let flexdoc of flex.docs) {
                    if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                    else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
                }
            }
            if (cflexes.length) {
                let chain = [{_id: doc.plain, doc, flexes: cflexes}]
                if (dictheads.length) chain.unshift(...dictheads) // unshift не для augs:
                chains.push(chain)
            }
        }

        let newhead = {_id: ddict._id, docs: ddict.docs}
        dictheads.push(newhead)

        // todo: if full

        // посчитать tail, и цикл и никаких switch не нужно
        let pdict = plain(ddict._id)
        /* if (pdict.length < 4) continue */
        let repdict = new RegExp('^'+pdict)
        let dicttail = pcwf.replace(repdict, '')
        if (dicttail == pcwf) continue
        f('_pdict', pdict, '_tail', dicttail)
        await dagging(dictheads, dicttail)

        // vowels
        let vowel = dicttail[0]
        if (!vowels.includes(vowel)) continue
        pdict = pdict + vowel
        /* if (pdict.length < 4) continue */
        repdict = new RegExp('^' + pdict)
        dicttail = pcwf.replace(repdict, '')
        f('_pdict_vow', pdict, '_tail', dicttail)
        if (dicttail == pcwf) continue
        /* if (pdict != 'παχυ') continue */
        dictheads.push({vowel: true, _id: vowel})
        await dagging(dictheads, dicttail)
        // si
    }

    /* if (dag[tail]) chains.push(_.flatten([headdict, dag[tail]])) */
    /* else await dagging(chains, tail, headdict, flexes) */
}

function dict2flex(headstr, tail, ddict, flexes) {
    for (let doc of ddict.docs) {
        let cflexes = []
        for (let flex of flexes) {
            if (tail != headstr + ddict._id + plain(flex._id)) continue
            for (let flexdoc of flex.docs) {
                if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
            }
        }
        if (cflexes.length) {
            let chain = [{_id: doc.plain, doc, flexes: cflexes}]
            /* if (dictheads.length) chain.unshift(...dictheads) // unshift не для augs: */
            chains.push(chain)
            return chain
        }
    }
}

function dict2plain(headstr, tail, ddict, flexes) {
    let dicts = []
    for (let doc of ddict.docs) {
        let cflexes = []
        for (let flex of flexes) {
            if (tail == headstr + ddict._id + plain(flex._id)) dicts.push(doc)
        }
        /* if (cflexes.length) {
         *     let chain = [{_id: doc.plain, doc, flexes: cflexes}]
         *     if (dictheads.length) chain.unshift(...dictheads) // unshift не для augs:
         *     chains.push(chain)
         *     return chain
         * } */
    }
    return dicts
}
