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
    let conts = await anthrax(wordform)
    // log('____conts', conts)

    if (!conts.length) {
        log('no result')
        return
    }

    for (let container of conts) {
        // log('_container', container)

        for (let chain of container.chains) {
            log('_r: rdict', chain.rdict)
            log('_r: morphs', chain.morphs)
        }
        // for (let chain of container.chains) {
        //     // log('_chain', chain)
        // }
    }


    return

    let cdicts = _.flatten(chains.map(chain=> chain.cdicts))
    // log('____cdicts', cdicts)

    let rdicts = cdicts.map(cdict=> cdict.rdict)
    rdicts = _.uniq(rdicts)
    // log('____rdicts', rdicts)

    let testdnames = ['wkt', 'dvr', 'lsj', 'bbl'] // , 'gram'
    let trnsdicts = await getTrns(rdicts, testdnames)
    let rtrns = trnsdicts.map(cdict=> cdict.rdict)
    // console.log('____rtrns', rtrns)

    for (let chain of chains) { //

        if (verbose) muteChain(chain)
        if (verbose) log('_CHAIN', chain)

        for (let cdict of chain.cdicts) {
            if (chain.indecl) log('_indecl:', cdict)
            // let pos = posByCdict(cdict)
            if (cdict.scheme) {
                let scheme = cdict.scheme.map(segment=> segment.seg).join('-')
                log('\n_scheme:', scheme)
            } else {
                log('\n_no_scheme:')
            }
            log('_rdict:', cdict.rdict, cdict.stem, cdict.dname, '_pos:', cdict.pos, '_pref', !!cdict.prefix)
            log('_morphs:', cdict.morphs)
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
    if (chain.indecl) return
    chain.rels = chain.rels.length
    chain.morels = chain.morels.length
}
