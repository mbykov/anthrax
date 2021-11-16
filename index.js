const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape, vowels } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'


/* let heads = tails.map(tail=> {
 *     let retail = new RegExp(tail+'$')
 *     return cwf.replace(retail, '')
 * }) */

const dag = {}

start(wordform)

async function start (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    let tails = flakes.map(flake=> flake.tail)
    /* log('_tails', wf, tails) */
    let flexes = await getFlexes(tails)
    tails = flexes.map(flex=> flex._id)
    /* log('_tails', tails) */
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
                if (!dag[pcwf]) dag[pcwf] = [seg, flex]
                chains.push(chain)
            }
        })
        if (full) continue
        let pseg = plain(seg._id)
        let repseg = new RegExp('^'+pseg)
        let tail = pcwf.replace(repseg, '')

        let headseg = _.clone(head)
        headseg.push(seg)
        log('_xx-tail', 'pseg:', pseg, tail)
        if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]]))
        else await dagging(chains, tail, headseg, flexes)

        let next = tail[0]
        if (!vowels.includes(next)) continue
        pseg = pseg + next
        repseg = new RegExp('^' + pseg)
        tail = pcwf.replace(repseg, '')
        if (tail == pcwf) continue
        headseg = _.clone(head)
        headseg.push(seg)
        headseg.push({vowel: true, _id: next})
        if (dag[tail]) chains.push(_.flatten([headseg, dag[tail]]))
        else await dagging(chains, tail, headseg, flexes)

    }
}
