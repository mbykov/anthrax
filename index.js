const log = console.log
// gitlab.rd.aorti.ru
// pass - liana - cuf -
// паша беляков - кротовкуф, днмкинкуф

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'
import { filters } from './lib/filters.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'


/* let heads = tails.map(tail=> {
 *     let retail = new RegExp(tail+'$')
 *     return cwf.replace(retail, '')
 * }) */

const dag = {}
let chains = []

anthrax(wordform)

async function anthrax (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    log('_flakes', flakes)
    let tails = flakes.map(flake=> flake.tail)
    // log('_tails', wf, tails)
    let flexes = await getFlexes(tails)
    let flexstrs = flexes.map(flex=> flex._id)
    log('_flexstrs', flexstrs)
    let pcwf = plain(cwf)
    log('_pcwf', pcwf)

    await dagging([], pcwf, flexes)
    // log('_raw chains', chains)
    // todo: filters
    let min = _.min(chains.map(chain=> chain.length))
    chains = chains.filter(chain=> chain.length < min + 3)

    chains.forEach(chain=> {
        let prefs = chain[0].docs.filter(doc=> doc.pref)
        /* log('_prefs', chain[0]) */
        let ids = chain.map(seg=> seg._id)
        log('_sgms', ids)
    })

    let cleans = chains.map(chain=> filters(chain)).filter(chain=> chain.length)
    cleans.forEach(clean=> {
        log('_clean', clean)
    })
}

async function dagging(heads, tail, flexes) {
    log('_dag', heads, tail)
    let flakes = scrape(tail)
    log('_dag_flakes_', flakes)
    let headkeys = flakes.map(flake=> plain(flake.head))
    log('_dag_headkeys_', headkeys)
    let segments = await getSegments(headkeys)
    log('_dag_segments_', segments)

}

// 1. вопросы: εἰσαγγέλλω - два одинаковых sgms, ἐξαγγέλλω - то же
// 2. wkt_names - чистый stripped, плюс aug, но не как в vebs, не отдельным сегментом, а для доп. проверки
// а здесь нужен level, и проверять name aug только в начале chain - жуть
// или, для однообразия, вычислять aug-names как в verbs?
// 3. почему я здесь получаю eimi, все варианты, если eimi есть в terms?

// то есть полная жопа. Думай



async function dagging_(chains, pcwf, head, flexes) {
    let flakes = scrape(pcwf)
    log('_flakes_', flakes)
    let heads = flakes.map(flake=> flake.head)
    if (pcwf == 'χος') log('_heads_HOS', heads)
    log('_heads_', heads)
    let segments = await getSegments(heads)
    // if (pcwf == 'χος')
    let ids = segments.map(seg=> seg._id)
    log('_segments', ids)

  for await (let seg of segments) {
    /* if (seg._id.length < 2) return */
    let full = false
    /* let headsrt = head.map(seg=> seg._id).join('') || '' */
    flexes.forEach(flex=> {
      if (pcwf == seg._id + plain(flex._id)) {
        let chain = [seg, flex]
        if (head.length) chain.unshift(...head)
        full = true
        /* if (pcwf == 'κρατια') log('_SEGM_KRAT', chain) */
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
    // log('_xx-tail', 'tail:', tail)
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
