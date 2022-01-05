//

import _  from 'lodash'
import { anthrax } from './index.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log
let fls = process.argv[3]

let chains = await anthrax(wordform)

for (let chain of chains) {
    log('\n_chain:', chain)
    if (!true)  continue

    chain.forEach(seg=> {
        if (seg.cdicts) {
            /* let rdicts = seg.cdicts.map(cdict=> cdict.rdict) */
            seg.cdicts.forEach(cdict=> {
                let fls = compactNameFls(cdict.fls)
                d('_dict', cdict.rdict)
                d('_fls', fls)
            })
        } else {
            log('_seg_no_cdicts:', seg)
        }
    })
}

function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}

function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.flatten(fls)
}
