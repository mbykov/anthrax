//

import _  from 'lodash'
import { anthrax } from './index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

let fls = process.argv[3]

let chains = await anthrax(wordform)

for (let chain of chains) {
    log('_chain:', chain)

    continue

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


if (fls) {
    /* let chain = chains[0][0]
     * let dicts = chain.cdicts.filter(dict=> dict.name && dict.gends)
     * let fls = compactNamesFls(dicts)
     * log('_FLS:', chain.cdicts[0].fls)
     * log('_FLS:', fls)
     * log('_DICTS:', dicts) */
}



function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.numcase].join('.'))
    })
    return _.flatten(fls)
}

function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.numcase].join('.')))
}
