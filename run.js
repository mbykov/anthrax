//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyIndecl, prettyFLS } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

let dbdefaults = ['wkt', 'bbh', 'lsj'] // , 'lsj' , 'bbl'

if (!wordform) log('no wordform')
else run(verbose)

async function run(verbose) {
    let chains = await anthrax(wordform, dbdefaults)

    if (!chains.length) {
        log('no result')
        return
    }

    for (let chain of chains) {
        let xxx = _.clone(chain)
        xxx.cfls = 'cfls'
        xxx.trns = 'trns'
        xxx.rels = 'rels'
        xxx.vars = 'vars'
        // log('\n_chain:', xxx)
        if (chain.indecl) {
            // log('\n_indecl chain:', chain)
            if (verbose) log('_trns:', chain.cdicts[0].trn)
        } else {
            log('\n_chain_reg:', xxx)
            for (let cdict of chain.cdicts) {
                log('\n_rdict', cdict.rdict, '_pos:', cdict.pos, '_morphs:', cdict.morphs)
                if (verbose) log('T', cdict.trn)
            }
            let scheme = chain.scheme.map(segment=> segment.seg).join('-')
            log('_scheme:', scheme)
        }
    }
}
