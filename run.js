//

import _  from 'lodash'
import { anthrax } from './index.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log
let fls = process.argv[3]

async function run() {
    let chains = await anthrax(wordform)
    log('\n_run chains:', wordform, chains.length)
    for (let chain of chains) {
        log('_chain:', chain)
        for (let seg of chain) {
            if (seg.cdicts) {
                let rdicts = seg.cdicts.map(cdict=> cdict.rdict || cdict.term)
                log('_rdicts', rdicts)
            }
        }

        let cdicts = chain.slice(-2)[0].cdicts
        let cfls = chain.slice(-1)[0].fls
        let idx = 0
        for (let cdict of cdicts) {
            let fls = cfls[idx]
            let prettys = prettyFLS(fls)
            log(prettys)
            idx++
        }

    }
}

run()

function prettyFLS(fls) {
    return fls.map(flex=> [flex.tense, flex.numper].join(', '))
}


// let chains = await anthrax(wordform)
// log('\n_RUN: chains:', chains.length)
/* log('\n_RUN-XXX: OS-FLS:', chains[1][1]) */

for (let chain of []) {
    log('\n_chain:', wordform, chain)
    if (!true)  continue

    let result = chain.map(seg=> seg.seg).join('-')

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
