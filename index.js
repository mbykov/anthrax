const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'


/* let heads = tails.map(tail=> {
 *     let retail = new RegExp(tail+'$')
 *     return cwf.replace(retail, '')
 * }) */

start(wordform)

async function start (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    let tails = flakes.map(flake=> flake.tail)
    log('_tails', wf, tails)
    let flexes = await getFlexes(tails)
    tails = flexes.map(flex=> flex._id)
    log('_tails', tails)
    let pcwf = plain(cwf)
    let chains = []
    await dagging(chains, pcwf, [], flexes)
    /* log('_chains', chains) */
    chains.forEach(chain=> {
        let sgms = chain.map(seg=> seg._id)
        log('_sgms', sgms)
    })
}

async function dagging(chains, pcwf, head, flexes) {
    /* if (pcwf == 'κρατια') log('_xx-head_KRAT', head) */
    let flakes = scrape(pcwf)
    let heads = flakes.map(flake=> flake.head)
    /* if (pcwf == 'κρατια') log('_heads_KRAT', heads) */
    let segments = await getSegments(heads)
    /* if (pcwf == 'κρατια') log('_segments_KRAT', segments) */
    for await (let seg of segments) {
        if (seg._id.length < 2) return
        let full = false
        /* let headsrt = head.map(seg=> seg._id).join('') || '' */
        flexes.forEach(flex=> {
            if (pcwf == seg._id + plain(flex._id)) {
                let chain = [seg, flex]
                if (head.length) chain.unshift(...head)
                full = true
                /* if (pcwf == 'κρατια') log('_SEGM_KRAT', chain) */
                chains.push(chain)
            }
        })
        if (!full) {
            let pseg = plain(seg._id)
            let repseg = new RegExp('^'+pseg)
            let tail = pcwf.replace(repseg, '')
            let headseg = _.clone(head)
            headseg.push(seg)
            let hstr = headseg.map(hs=> hs._id)
            log('_xx-tail', hstr, pseg, tail)
            await dagging(chains, tail, headseg, flexes)

            let pseg_o = pseg + 'ο'
            let repseg_o = new RegExp('^' + pseg_o)
            let tail_o = pcwf.replace(repseg_o, '')
            if (tail_o != pcwf) {
                let headseg_o = _.clone(head)
                headseg_o.push(seg)
                headseg_o.push({vowel: true, _id: 'ο'})
                hstr = headseg_o.map(hs=> hs._id)
                log('_xx-tail_o', hstr, pseg_o, tail_o)
                /* headseg_o = _.flatten(headseg_o) */
                await dagging(chains, tail_o, headseg_o, flexes)
            }
        }
    }
    /* segments.forEach(async seg=> {
     * }) */
}
