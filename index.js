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
    let flexes = await getFlexes(tails)
    let flexstrs = flexes.map(flex=> flex._id)
    d('_flexstrs', flexstrs)
    let pcwf = plain(cwf)
    d('_pcwf', pcwf)
    await dagging([], cwf, flexes)
    log('_raw chains_:', chains)

    const dag = {
        level: 0,
        pcwf,
        flexes,
        dive (headdocs, tail) { return dive.apply(this, arguments) },
        chains: [],
    }

    await dag.dive([], cwf)
    log('_chains_', dag.chains)
}

async function dive(heads, tail) {
    log('_dive_heads', heads)
    this.level += 1
    f('_level_', this.level)
    f('_flexes_', this.flexes.length)
    f('_tail_', tail)
    let flakes = scrape(tail)
    let dictkeys = flakes.map(flake=> plain(flake.head))
    f('_dictkeys_', dictkeys)
    f('_this.pcwf_', this.pcwf)

    let ddicts = await getSegments(dictkeys)
    if (!ddicts.length) return
    let ddicts_ids = ddicts.map(ddict=> ddict._id)
    f('_ddicts_ids_', ddicts.length, 'ddicts_ids:', ddicts_ids)

    await doc2flex.apply(this, [heads, ddicts])

    return tail + '_end'
}

async function doc2flex(heads, ddicts) {
    log('_CYCLE', this.pcwf)
    log('_DDICTS', ddicts.length)
    let headstr = heads.map(doc=> doc._id).join('')
    log('_headstr_', heads.length, headstr)
    for (let ddict of ddicts) {
        for (let doc of ddict.docs) {
            let cflexes = []
            for (let flex of this.flexes) {
                if (this.pcwf != headstr + ddict._id + plain(flex._id)) continue
                for (let flexdoc of flex.docs) {
                    if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                    else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
                }
            }
            if (cflexes.length) {
                let chain = [{_id: doc.plain, doc, flexes: cflexes}]
                log('____________HEADS_1', heads.length)
                if (heads.length) chain.unshift(...heads) // unshift не для augs:
                this.chains.push(chain)
                log('____________HERE', ddict._id, cflexes.length, this.chains.length)
            }
        }

        let newhead = {_id: ddict._id, docs: ddict.docs}
        let newheads = _.clone(heads)
        newheads.push(newhead)

        let pddict = plain(ddict._id)
        let repddict = new RegExp('^'+pddict)
        let newtail = pcwf.replace(repddict, '')
        if (newtail == pcwf) continue
        log('_pdict', pdict, '_newtail', newtail)
        await dag.dive.apply(this, newheads, newtail)

    }
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
        /* let headdocs = [] */

        if (heads.length == 0) {
            // ==> doc2flex
            // unshift
        } else if (heads.length == 1) {
            let aug = seg.docs.find(doc=> doc.aug)
            // ==> doc2flex
            // if (aug) => doc2flex без unshift
            // else => doc2plain
        } else {
            // heads - есть, > 1
            // doc2plain
            // unshift
        }

        for (let doc of seg.docs) {
            /* log('_D', doc.rdict) */
            let cflexes = []
            for (let flex of flexes) {
                if (pcwf != headstr + seg._id + plain(flex._id)) continue
                for (let flexdoc of flex.docs) {
                    if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                    else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) cflexes.push(flexdoc)
                }
            }
            if (cflexes.length) {
                let segchain = [{_id: doc.plain, doc, flexes: cflexes}]
                if (segheads.length) segchain.unshift(...segheads) // unshift не для augs:
                chains.push(segchain)
                /* headdocs.push(doc) */
            }
        }
        let newhead = {_id: seg._id, docs: seg.docs}
        segheads.push(newhead)

        // todo: if full

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
        // si
    }

    /* if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]])) */
    /* else await dagging(chains, tail, headseg, flexes) */



    return chains

    return
    let min = _.min(chains.map(chain=> chain.length))

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
