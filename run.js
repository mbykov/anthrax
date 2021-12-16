//

import _  from 'lodash'
import { anthrax } from './index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

let fls = process.argv[3]

let chains = await anthrax(wordform)

for (let chain of chains) {

    log('\n_chain:', chain)
    if (!true)  continue

    let plains = chain.map(seg=> seg.plain)
    /* log('plains', plains, _.last(chain).flex) */
    chain.forEach(seg=> {
        if (seg.cdicts) {
            let cdicts = seg.cdicts.map(cdict=> cdict.rdict)
            seg.cdicts.forEach(cdict=> {
                let fls = compactNameFls(cdict.fls)
                log('_dict', cdict.rdict, fls)
            })


        } else {
            log('_seg:', seg)
        }
    })
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
