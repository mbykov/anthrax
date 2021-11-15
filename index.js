const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { accents, scrape } from './lib/utils.js'
import { getFlexes } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'


start(wordform)

async function start (wf) {
    let cwf = comb(wf)
    log('_start', cwf)
    let flakes = scrape(cwf)
    let tails = flakes.map(flake=> flake.tail)
    log('_tails', tails)
    let flexes = await getFlexes(tails)
    log('_start flexes', flexes)
}
