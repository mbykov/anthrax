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
    if (!flakes.length) return
    let tails = flakes.map(flake=> flake.tail)
    let flexes = await getFlexes(tails)
    let flexstrs = flexes.map(flex=> flex._id)
    d('_flexstrs', flexstrs)
    pcwf = plain(cwf)
    d('_pcwf', pcwf)
    await dagging([], cwf, flexes)

    log('_raw chains_:', chains)
    return
    let min = _.min(chains.map(chain=> chain.length))
}

async function dagging(heads, tail, flexes) {
    let flakes = scrape(tail)
    let headkeys = flakes.map(flake=> plain(flake.head))
    h('_headkeys_', headkeys)
    let segments = await getSegments(headkeys)
    if (!segments.length) return
    let segids = segments.map(seg=> seg._id)
    h('_segids_', segments.length, 'segments:', segids, 'tail:', tail)
    let headstr = heads.map(doc=> doc._id).join('')
    h('_headstr_', heads.length, headstr)

    for await (let seg of segments) {
        let segheads = _.clone(heads)
        let headdocs = []
        for (let doc of seg.docs) {
            /* log('_D', doc.rdict) */
            let cflexes = []
            for (let flex of flexes) {
                if (pcwf != headstr + doc.plain + plain(flex._id)) continue
                for (let flexdoc of flex.docs) {
                    if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                    else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
                }
            }
            if (cflexes.length) {
                let segchain = [doc, cflexes]
                if (heads.length) segchain.unshift(...heads)
                chains.push(segchain)
                headdocs.push(doc)
            }
        }
        let lasthead = {_id: seg._id, docs: seg.docs}
        segheads.push(lasthead)

        // посчитать tail, и цикл и никаких switch не нужно
        let pseg = plain(seg._id)
        let repseg = new RegExp('^'+pseg)
        let segtail = pcwf.replace(repseg, '')
        if (segtail == pcwf) continue
        log('_pseg', pseg, '_tail', segtail)
        await dagging(segheads, segtail, flexes)

        // vowels
        let vowel = segtail[0]
        if (!vowels.includes(vowel)) continue
        pseg = pseg + vowel
        repseg = new RegExp('^' + pseg)
        segtail = pcwf.replace(repseg, '')
        log('_pseg_vow', pseg, '_tail', segtail)
        if (segtail == pcwf) continue
        /* if (pseg != 'παχυ') continue */
        segheads.push({vowel: true, _id: vowel})
        await dagging(segheads, segtail, flexes)


    }

    /* if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]])) */
    /* else await dagging(chains, tail, headseg, flexes) */



    return chains

    if (!flakes.length) return

    for await (let seg of segments) {
        h('_segid_', seg._id)
        let cleans = filter(tail, seg, flexes)
    }

    return cleans

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
