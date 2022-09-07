//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyRes } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log
// let fls = process.argv[3]

async function run() {
    let chain = await anthrax(wordform)
    log('_run_chain_:', chain)
    let prettyres = prettyRes(chain)
    log('_prettyres:', prettyres)
}

async function run_() {
    let res = []
    let chains = await anthrax(wordform)
    let indecls = chains.filter(chain=> chain.length == 1)
    if (indecls.length) {
        let indecl = indecls[0][0]
        log('_INDECL', indecl.seg, indecl.cdicts)
        // log('_fls:', indecl.cdicts[0].fls)
        return
    }
    // chains = chains.filter(chain=> chain.length > 1)
    log('\n_run chains:', wordform, chains.length)
    for (let chain of chains) {
        log('_chain:', chain)
        let prettyres = prettyRes(chain)
        log('_prettyres:', prettyres)
        // res.push(prettyres)
        // log('_fls:', chain[2].fls)
    }
    // log('_res:', res)
}

run()



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

function compactNamesFls_(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.flatten(fls)
}
