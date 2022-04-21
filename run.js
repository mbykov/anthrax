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

    let result = chain.map(seg=> [seg.aug, seg.plain, seg.flex].join('-')).join('-')
    log('_result:_', result)

    continue

    chain.forEach(seg=> {
        if (seg.cdicts) {
            /* let rdicts = seg.cdicts.map(cdict=> cdict.rdict) */
            seg.cdicts.forEach(cdict=> {
                if (!cdict.fls) cdict.fls = [] // heads as prefixes, compounds, etc
                let advfls = cdict.fls.filter(flex=> flex.adv)
                advfls = compactAdvFls(advfls)
                let fls = cdict.fls.filter(flex=> !flex.adv)
                fls = compactNameFls(fls)
                let irreg = cdict.irreg ? '_irreg_' : ''
                d('_dict', cdict.rdict, irreg)
                if (fls.length) d('_fls', fls.sort())
                if (advfls.length) d('_adv', advfls)
            })
        } else {
            /* log('_seg_no_cdicts:', seg) */
        }
    })
}

function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}

function compactAdvFls(flexes) {
    return _.uniq(flexes.map(flex=> ['adv', flex.degree].join('.')))
}

function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.flatten(fls)
}
