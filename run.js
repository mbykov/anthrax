//

import _  from 'lodash'
import { anthrax } from './index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

let chains = await anthrax(wordform)

for (let chain of chains) {
    log('_chain:', chain)
    for (let seg of chain) {
        /* log('_seg:', seg) */
        if (!seg.dicts) continue
        for (let dict of seg.dicts) {
            log('_dict:', dict.rdict, '_plain:', dict.plain)
            if (dict.flexes) log('_flexes:', dict.flexes.length)
            /* if (dict.flexes) log('_cmpfls:', compactNameFls(dict.flexes)) */
        }
    }
    /* log('_Z', chain[chain.length -1]) */
}

/* log('_R:', chains[1][0].dicts) */

function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.numcase].join('.')))
}
