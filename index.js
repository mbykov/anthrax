const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
import { filters, simple } from './lib/filters.js'
import Debug from 'debug'

/* let heads = tails.map(tail=> {
 *     let retail = new RegExp(tail+'$')
 *     return cwf.replace(retail, '')
 * }) */

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
const dag = {}
let chains = []
let pcwf = ''
const d = Debug('app')
const h = Debug('dag:head')
const f = Debug('dag:filter')

anthrax(wordform)

async function anthrax (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    d('_flakes', flakes)
    let tails = flakes.map(flake=> flake.tail)
    let flexes = await getFlexes(tails)
    let flexstrs = flexes.map(flex=> flex._id)
    d('_flexstrs', flexstrs)
    pcwf = plain(cwf)
    d('_pcwf', pcwf)

    await dagging([], pcwf, flexes)

    log('_raw chains_:', chains)

    return
    let min = _.min(chains.map(chain=> chain.length))

    /* let cleans = chains.map(chain=> filters(chain)).filter(chain=> chain.length) */
    chains.forEach(clean=> {
        d('_clean', clean)
    })
}

// 1. вопросы: εἰσαγγέλλω - два одинаковых sgms, ἐξαγγέλλω - то же
// 2. wkt_names - чистый stripped, плюс aug, но не как в vebs, не отдельным сегментом, а для доп. проверки
// а здесь нужен level, и проверять name aug только в начале chain - жуть
// или, для однообразия, вычислять aug-names как в verbs?
// 3. почему я здесь получаю eimi, все варианты, если eimi есть в terms?

async function dagging(heads, tail, flexes) {
    h('_dag', tail)
    let flakes = scrape(tail)
    if (!flakes.length) return
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let segments = await getSegments(headkeys)
    let segids = segments.map(seg=> seg._id)
    h('_segids_', segments.length, 'segments:', segids)

    for await (let seg of segments) {
        let full = false
        flexes.forEach(flex=> {
            let chain = simple(tail, seg, flex)
            if (!chain) return
            full = true
            /* if (heads.length) chain.unshift(...heads) */
            if (!dag[tail]) dag[tail] = chain
            chains.push(...chain)
        })
        h('full', seg._id, full)
        if (full) continue

        heads.push(seg)
        let pseg = plain(seg._id)
        let repseg = new RegExp('^'+pseg)
        tail = pcwf.replace(repseg, '')
        if (tail == pcwf) continue
        h('_next_level_:', pseg, '+', tail)
        /* if (tail != 'γαθοεργεω') continue */
        await dagging(heads, tail, flexes)

    }
}

async function dagging_(chains, pcwf, head, flexes) {
    let flakes = scrape(pcwf)
    d('_flakes_', flakes)
    let heads = flakes.map(flake=> flake.head)
    if (pcwf == 'χος') d('_heads_HOS', heads)
    d('_heads_', heads)
    let segments = await getSegments(heads)
    // if (pcwf == 'χος')
    let ids = segments.map(seg=> seg._id)
    d('_segments', ids)

  for await (let seg of segments) {
    /* if (seg._id.length < 2) return */
    let full = false
    /* let headsrt = head.map(seg=> seg._id).join('') || '' */
    flexes.forEach(flex=> {
      if (pcwf == seg._id + plain(flex._id)) {
        let chain = [seg, flex]
        if (head.length) chain.unshift(...head)
        full = true
        /* if (pcwf == 'κρατια') d('_SEGM_KRAT', chain) */
        if (!dag[pcwf]) dag[pcwf] = [seg, flex]
        chains.push(chain)
      }
    })
    if (full) continue

    let pseg = plain(seg._id)
    let repseg = new RegExp('^'+pseg)
    let tail = pcwf.replace(repseg, '')
    // await diveDag(chains, seg, tail, head, flexes)

    let next = tail[0]
    if (!vowels.includes(next)) continue

    pseg = pseg + next
    repseg = new RegExp('^' + pseg)
    tail = pcwf.replace(repseg, '')
    if (tail == pcwf) continue
    // await diveVowel(chains, seg, tail, head, next, flexes)
    // todo: -si- ??
  } // seg of segments
}

async function diveDag(chains, seg, tail, head, flexes) {
    let headseg = _.clone(head)
    headseg.push(seg)
    // d('_xx-tail', 'tail:', tail)
    if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]]))
    else await dagging(chains, tail, headseg, flexes)
}

async function diveVowel(chains, seg, tail, head, next, flexes) {
    let headseg = _.clone(head)
    headseg.push(seg)
    headseg.push({vowel: true, _id: next})
    if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]]))
    else await dagging(chains, tail, headseg, flexes)
}
