//

import _  from 'lodash'
import { anthrax } from './index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

let res = await anthrax(wordform)


for (let chain of res) {
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
}

/* log('_R:', res[0][0].dicts[0]) */


function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.numcase].join('.')))
}
