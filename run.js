//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyName, prettyVerb } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let prettyfls = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

if (!wordform) log('no wordform')
else run()

async function run() {
    let chains = await anthrax(wordform)
    log('_run_chains_:', chains)
    for (let chain of chains) {
        // log('_INDECL_:', chain[0].cdicts)

        let segs = chain.map(seg=> seg.seg).join('-')
        // let main = chain.find(seg=> seg.mainseg)
        // log('_cdicts:', main.cdicts)
        log('_scheme:', segs)
        let pretty = prettyFLS(chain)
        log('_morphs:', pretty)
    }
}

function prettyFLS(chain) {
    let mseg = chain.find(seg=> seg.mainseg)
    let fls = chain.find(seg=> seg.fls).fls
    let morphs = ''
    if (mseg.name) morphs = prettyName(fls)
    else if (mseg.verb) morphs = prettyVerb(fls)
    return morphs
}
