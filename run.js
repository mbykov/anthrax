//

import _  from 'lodash'
import { anthrax } from './index.js'
import { cleanString, prettyIndecl, prettyFLS } from './lib/utils.js'

import Debug from 'debug'
const d = Debug('dicts')

import { createDBs, getFlexes, getNests, getTrns } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

// let dnames

// check greek TODO:
if (!wordform) log('no wordform')
else run(verbose)


async function run(verbose) {
    await createDBs()

    // проверка на greek - хоть один символ
    // клик на слове - получить три - до, клик, после
    // enclitics
    wordform = cleanString(wordform)

    // TODO: отдельно - сначала indecl-DB
    let chains = await anthrax(wordform)

    if (!chains.length) {
        log('no result')
        return
    }

    if (!chains.length > 2) log('________________________________too many chains', chains.length)

    let cdicts = _.flatten(chains.map(chain=> chain.cdicts))
    // log('____cdicts', cdicts)

    let dictkeys = cdicts.map(cdict=> cdict.dict)
    dictkeys = _.uniq(dictkeys)

    let testdnames = ['wkt', 'dvr']
    let trnsdicts = await getTrns(dictkeys, testdnames)
    // log('____TRNS', trnsdicts.length)

    for (let chain of []) { // chains
        for (let cdict of chain.cdicts) {
            // let pos = posByCdict(cdict)
            // cdict.trn = {}
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            for (let tdict of tdicts) {
                // log('____tdict.dname', tdict.dname)
                // cdict.trn[tdict.dname] = tdict.trns
            }
            delete cdict.trns
        }
    }

    // log('_CHAINS', chains)

    // let schemes = chains.map(chain=> chain.scheme.map(segment=> segment.seg).join('-'))
    // if (verbose) log('\n___schemes:', schemes.sort().join('; '))

    for (let chain of chains) { //
        if (!verbose) chain = muteChain(chain)
        else log('_CHAIN', chain)

        for (let cdict of chain.cdicts) {
            if (chain.indecl) log('_indecl:')
            // let pos = posByCdict(cdict)
            if (cdict.scheme) {
                let scheme = cdict.scheme.map(segment=> segment.seg).join('-')
                log('\n_scheme:', scheme)
            } else {
                log('\n_no_scheme:')
            }
            log('_rdict:', cdict.rdict, cdict.stem, cdict.dname, '_pos:', cdict.pos, '_pref', !!cdict.prefix)
            log('_morphs:', cdict.morphs)
            if (verbose) log('_TRN_0', cdict.trns)
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

function muteChain(chain) {
    chain.cfls = 'cfls'
    // chain.trns = 'trns'
    chain.rels = 'rels'
    chain.morels = 'morels'
    return chain
}
