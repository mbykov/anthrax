const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels, parseAug } from './lib/utils.js'
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
let dag = new Map();

const d = Debug('app')
const h = Debug('head')
const g = Debug('dag')

anthrax(wordform)

async function anthrax (wf) {
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
    await dagging([], dag.pcwf)

    log('_raw chains_:', chains)
}

// ἀγαθοποιέω, βαρύτονος, ἄβακος, βαρύς, τόνος, καθαρισμός, ἀγαθός

async function getDicts(tail) {
    let flakes = scrape(tail)
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let ddicts = await getSegments(headkeys)
    // todo: return ddicts
    let dictids = ddicts.map(dict=> dict._id)
    log('_dictids_', dictids, 'tail:', tail)
    return ddicts
}

async function dagging(oldheads, tail) {
    let ddicts = await getDicts(tail)
    if (!ddicts.length) return
    let headstr = oldheads.map(doc=> doc._id).join('')
    g('_headstr_', oldheads.length, headstr, '_tail_', tail)

    for (let ddict of ddicts) {
        g('___ddict_start:', ddict._id)
        let stop = false
        let heads = _.clone(oldheads)
        if (heads.length == 0) {
            let aug = parseAug(tail)
            if (aug) {
                heads.push({_id: aug, aug: true})
                let reaug = new RegExp('^'+aug)
                let newtail = tail.replace(reaug, '')
                await dagging(heads, newtail)
                stop = true
            }
        }  else if (heads.length == 1) {
            let aug = heads.find(doc=> doc.aug)
            /* log('___after-aug:', aug._id, ddict._id, tail) */
            let chain = dict2flex(headstr, ddict, dag.flexes)
            /* log('___chain___:', !!chain) */
            /* if (!aug) chain.unshift(...heads) */
            heads.push({_id: ddict._id, docs: ddict.docs})
        } else {
            log('__ELSE', ddict._id, headstr)
            let dicts = dict2plain(heads, ddict, dag.flexes)

        }
        if (stop) continue

        let pdict = plain(ddict._id)
        if (pdict != 'γαθ') continue
        let repdict = new RegExp('^'+pdict)
        let nexttail = tail.replace(repdict, '')
        if (dag.flexids.includes(nexttail)) continue

        let vowel = nexttail[0]
        if (!vowels.includes(vowel)) continue
        pdict = pdict + vowel
        repdict = new RegExp('^' + pdict)
        nexttail = tail.replace(repdict, '')
        /* g('_pdict_vow', pdict, '_nexttail', nexttail) */
        if (nexttail == tail) continue
        /* if (pdict != 'παχυ') continue */
        heads.push({_id: vowel, vowel: true})
        log('_========pdict_2', pdict, vowel, '_nexttail:', nexttail, heads)
        await dagging(heads, nexttail)


    } // ddicts
}

async function dagging_(oldheads, tail) {
    let ddicts = await getDicts(tail)
    if (!ddicts.length) return

    if (oldheads.length) ddicts = ddicts.filter(ddict => ddict._id.length > 2)

    let headstr = oldheads.map(doc=> doc._id).join('')
    log('_headstr_', oldheads.length, headstr, '_tail_', tail)

    for (let ddict of ddicts) {
        log('___ddict_start:', ddict._id)
        let heads = _.clone(oldheads)

        if (heads.length == 0) {
            let chain = dict2flex(headstr, ddict, flexes)
            let newhead = {_id: ddict._id, docs: ddict.docs}
            heads.push(newhead)
            log('_____N-0', tail, 'ddict._id:', ddict._id, 'chains:', chains.length)
            /* if (chain) chain.unshift(...dictheads) */
        } else if (heads.length == 1) {
            log('_____N-1', tail, 'ddict._id:', ddict._id, 'chains', chains.length)
            let aug = ddict.docs.find(doc=> doc.aug)
            if (aug) {
                let chain = dict2flex(headstr, ddict, flexes)
                let newhead = {_id: ddict._id, docs: ddict.docs}
                heads.push(newhead)
                log('_____N-1-aug', tail, 'ddict._id:', ddict._id, 'chains', chains.length)
                log('_____N-1-aug', heads.length)
            } else {
                let dicts = dict2plain(headstr, ddict, flexes)
            }
            // ==> doc2flex
            // if (aug) => doc2flex без unshift
            // else => doc2plain
        } else {
            /* let dicts = dict2plain(headstr, ddict, flexes) */
            log('_____N-N', tail, '=', headstr, 'ddict._id:', ddict._id, 'chains', chains.length)
            let chain = dict2flex(headstr, ddict, flexes)
            if (chain) chain.unshift(...heads)
            log('_____N-N_', tail, '=', headstr, 'ddict._id:', ddict._id, 'chains', chains.length)
            log('_____N-N_chain', chain)
            /* let newhead = {_id: ddict._id, docs: ddict.docs} */
            /* heads.push(newhead) */
            log('_____N-N-0', tail, 'ddict._id:', ddict._id, 'chains', chains.length)
            /* if (dicts) chain.unshift(...heads) */
            // heads - есть, > 1
            // doc2plain
            // unshift
        }
        log('_____HEADS__', heads, 'oldtail:', tail, 'chains:', chains)


        // посчитать tail, и цикл и никаких switch не нужно
        let pdict = plain(ddict._id)
        /* if (pdict.length < 4) continue */
        let repdict = new RegExp('^'+pdict)
        let nexttail = tail.replace(repdict, '')
        log('_========pdict_1', pdict, '_nexttail:', nexttail, 'tail:', tail, heads.length)
        if (nexttail == tail) continue
        if (nexttail == 'οποιέω') nexttail = 'ποιέω'
        log('_========pdict_1_1', pdict, '_nexttail:', nexttail, 'tail:', tail, heads.length)
        await dagging(heads, nexttail)

        // vowels
        let vowel = nexttail[0]
        if (!vowels.includes(vowel)) continue
        pdict = pdict + vowel
        /* if (pdict.length < 4) continue */
        repdict = new RegExp('^' + pdict)
        nexttail = pcwf.replace(repdict, '')
        /* g('_pdict_vow', pdict, '_nexttail', nexttail) */
        log('_========pdict_2', pdict, '_nexttail:', nexttail, 'tail:', tail, heads.length)
        if (nexttail == pcwf) continue
        /* if (pdict != 'παχυ') continue */
        heads.push({vowel: true, _id: vowel})
        /* await dagging(heads, nexttail) */
        // si
    }

    /* if (dag[tail]) chains.push(_.flatten([headdict, dag[tail]])) */
    /* else await dagging(chains, tail, headdict, flexes) */
}

function dict2flex(headstr, ddict, flexes) {
    for (let doc of ddict.docs) {
        let cflexes = []
        for (let flex of flexes) {
            if (dag.pcwf != headstr + ddict._id + plain(flex._id)) continue
            for (let flexdoc of flex.docs) {
                if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
            }
        }
        if (cflexes.length) {
            /* let chain = [{_id: doc.plain, doc, flexes: cflexes}] */
            let chain = [{dict: doc.dict, doc, flexes: cflexes}]
            chains.push(chain)
            return chain
        }
    }
}

function dict2plain(heads, ddict, flexes) {
    let headstr = heads.map(doc=> doc._id).join('')
    let dicts = []
    for (let doc of ddict.docs) {
        let cflexes = []
        for (let flex of flexes) {
            if (dag.pcwf == headstr + ddict._id + plain(flex._id)) dicts.push(doc)
            log('___else pushed', doc.plain)
        }
    }
    let chain = [{_id: ddict._id, dicts, flexes}]
    chain.unshift(heads)
    chains.push(chain)
    return dicts
}
