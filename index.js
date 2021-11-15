const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape } from './lib/utils.js'
import { getFlexes, getSegments } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'


start(wordform)

async function start (wf) {
    let cwf = comb(wf)
    let flakes = scrape(cwf)
    let tails = flakes.map(flake=> flake.tail)
    log('_tails', wf, tails)
    let flexes = await getFlexes(tails)
    tails = flexes.map(flex=> flex._id)
    log('_tails', tails)

    /* let heads = tails.map(tail=> {
     *     let retail = new RegExp(tail+'$')
     *     return cwf.replace(retail, '')
     * }) */
    let pcwf = plain(cwf)
    /* log('_palin', pcwf)
     * flakes = scrape(pcwf)
     * let heads = flakes.map(flake=> flake.head)
      */

    let chains = await dagging(pcwf)
    log('_chains', chains)
    // todo: запрос heads
    // выбрать chains
    // start DAG
}

async function dagging(str) {
    let flakes = scrape(str)
    let heads = flakes.map(flake=> flake.head)
    log('_heads', heads)
    let segments = await getSegments(heads)
    log('_segments', segments)


    return 'kuku'
}
