//

import _  from 'lodash'
import { anthrax } from './index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

let fls = process.argv[3]

let chains = await anthrax(wordform)

for (let chain of chains) {
    log('_chain:', chain)
    for (let seg of chain) {
        /* log('_seg:', seg) */
        if (!seg.cdicts) continue
        for (let dict of seg.cdicts) {
            continue
            log('_dict:', dict.rdict, '_plain:', dict.plain)
            if (dict.flexes) log('_flexes:', dict.flexes.length)
            /* if (dict.flexes) log('_cmpfls:', compactNameFls(dict.flexes)) */
        }
    }
    /* log('_Z', chain[chain.length -1]) */
}

if (fls) log('_FLS:', chains[0][0].cdicts[0].fls)
/* if (fls) log('_FLS:', JSON.stringify(chains[0][0].cdicts[0].fls[0])) */

log('_DICTS:', chains[0][0].cdicts)


function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.numcase].join('.')))
}
