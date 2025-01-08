//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyIndecl, prettyFLS } from './lib/utils.js'

import Debug from 'debug'
const d = Debug('dicts')

import { createDBs, getFlexes, getDicts, getNests } from './lib/remote.js'


let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

let dnames
let dbdefaults = ['wkt', 'bbh', 'lsj'] // , 'lsj' , 'bbl'

// check greek TODO:
if (!wordform) log('no wordform')
else run(verbose)


async function run(verbose) {
    if (!dnames) dnames = dbdefaults
    dnames.push('nest')
    await createDBs(dnames)


    // TODO: отденьно - сначала indecl-DB
    let chains = await anthrax(wordform)

    if (!chains.length) {
        log('no result')
        return
    }

    // log('_CHS', chains)

    await addTrns(chains)
    // log('_run chains', chains)

    for (let chain of chains) {
        if (!verbose) chain = muteChain(chain)
        // log('_CHAIN', chain)
        for (let cdict of chain.cdicts) {

            let pos = 'xxx'
            if (cdict.verb) pos = 'verb'
            else if (cdict.name && cdict.adj) pos = 'adj'
            else if (cdict.name) pos = 'noun'

            log('\n_rdict:', cdict.rdict, '_pos:', pos, '_morphs:', cdict.morphs)
            if (verbose) log('_cdict', cdict)
            if (chain.indecl) log('_indecl')

        }

        if (chain.scheme) { // TODO: indecls ?
            let scheme = chain.scheme.map(segment=> segment.seg).join('-')
            log('_scheme:', scheme)
        }

        if (verbose && chain.rels) {
            let rels = chain.rels.map(dict=> dict.rdict)
            log('_rels:', rels.length)
        }


    }
}

async function addTrns(chains) {
    let dictkeys = []
    for (let chain of chains) {
        // if (chain.indecl) continue
        let cdictkeys = chain.cdicts.map(cdict=> cdict.dict)
        dictkeys.push(...cdictkeys)
    }

    dictkeys = _.uniq(dictkeys)
    // log('_TRNS_dictkeys', dictkeys)

    let trnsdicts = await getDicts(dictkeys)
    // log('_TRNS_tdicts', tdicts.length)
    // let trns_rdicts = trnsdicts.map(cdict=> cdict.rdict)
    // log('_TRNS_trdicts', trns_rdicts)

    for (let chain of chains) {
        for (let cdict of []) { // chain.rels
            cdict.trn = {}
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            // cdict.trns = tdict.trns
            for (let tdict of tdicts) {
                cdict.trn[tdict.dname] = tdict.trns
            }
        }
        for (let cdict of chain.cdicts) {
            cdict.trn = {}
            // log('____________________________c', cdict.rdict, cdict.dname)
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            for (let tdict of tdicts) {
                // log('____________________________c_t', tdict.dname, tdict.trns)
                cdict.trn[tdict.dname] = tdict.trns
            }
        }
    }
}

function muteChain(chain) {
    chain.cfls = 'cfls'
    // chain.trns = 'trns'
    chain.rels = 'rels'
    return chain
}
