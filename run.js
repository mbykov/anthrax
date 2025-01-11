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

    // проверка на greek - хоть один символ
    // клик на слове - получить три - до, клик, после
    // enclitics


    // TODO: отдельно - сначала indecl-DB
    let chains = await anthrax(wordform)

    if (!chains.length) {
        log('no result')
        return
    }

    if (!chains.length > 2) log('________________________________too many chains', chains.length)

    // log('_CHAINS', chains)

    await addTrns(chains)

    for (let chain of chains) {
        if (!verbose) chain = muteChain(chain)
        // log('_CHAIN', chain)
        if (chain.scheme) { // TODO: indecls ?
            let scheme = chain.scheme.map(segment=> segment.seg).join('-')
            log('\n_chain.scheme:', chain.scheme)
            log('_scheme:', scheme)
        }

        for (let cdict of chain.cdicts) {
            if (chain.indecl) log('_indecl:')
            let pos = posByCdict(cdict)
            log('_rdict:', cdict.rdict, '_pos:', pos)
            log('_morphs:', cdict.morphs)
            if (verbose) log('_cdict', cdict)
        }

        if (verbose && chain.rels) {
            let rels = chain.rels.map(dict=> dict.rdict)
            log('_rels:', rels.length)
        }


    }
}

function posByCdict(cdict) {
    let pos = ''
    if (cdict.verb) pos = 'verb'
    else if (cdict.name && cdict.adj) pos = 'adj'
    else if (cdict.name) pos = 'noun'
    return pos
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
            delete cdict.trns
        }

        for (let cdict of chain.cdicts) {
            cdict.trn = {}
            // log('____________________________c', cdict.rdict, cdict.dname)
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            for (let tdict of tdicts) {
                // log('____________________________c_t', tdict.dname, tdict.trns)
                cdict.trn[tdict.dname] = tdict.trns
            }
            delete cdict.trns
        }
    }
}

function muteChain(chain) {
    chain.cfls = 'cfls'
    // chain.trns = 'trns'
    chain.rels = 'rels'
    return chain
}
