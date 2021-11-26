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
            log('__ELSE', headstr, ddict._id)
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
    let vowel = (heads.slice(-1)[0].vowel) ? heads.slice(-1)[0]._id : null
    for (let doc of ddict.docs) {
        let corr = false
        for (let flex of flexes) {
            // length correct:
            if (dag.pcwf == headstr + ddict._id + plain(flex._id)) corr = true
            // doc.aug corresponds connecting vowel:
            if (doc.aug && doc.aug != vowel) corr = false
            // todo: считать dict отдельно - verb+flex.verb, name+flex.name
            // todo: flex.name могут соответствовать и doc.verb также, но flex.verb должны соответствовать только doc.verb only
            // todo: если соответствия есть, то dict протустить
            // на омеге облом - пройдут name
        }
        if (corr) dicts.push(doc)
        if (corr) log('___else pushed', doc.rdict, '_vow:', vowel, '_aug:', doc.aug)
    }
    let chain = [{_id: ddict._id, dicts, flexes}]
    chain.unshift(...heads)
    chains.push(chain)
    return dicts
}
