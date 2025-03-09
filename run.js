//

import _  from 'lodash'
import { anthrax } from './index.js'
import { cleanString, prettyIndecl, prettyFLS } from './lib/utils.js'
import {oxia, comb, plain, strip} from 'orthos'

import Debug from 'debug'
const d = Debug('dicts')

import { createDBs, getFlexes, getNests, getCacheD, getTrns, getIndecls, getCacheI } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

// check greek TODO:
if (!wordform) log('no wordform')
else run(verbose)

let nocache = !!process.env.NO_CACHE

/*
  - index.js =>
  - getIndecls / getCacheI
  - anthrax / cacheA
  - getCompactedDicts / getCacheD
  - merge:
  - conts +

 */

// обнулить Indecls
//  rm -rf ../pouch-anthrax/cacheI

async function run(verbose) {
    await createDBs()
    // проверка на greek - хоть один символ
    wordform = cleanString(wordform)

    let cwf = comb(wordform)
    let indecls = await getCacheI(cwf)
    log('______________________________________indecls', indecls)


    return

    // TODO: отдельно - сначала indecl-DB
    let conts = await anthrax(wordform)
    // log('____conts', conts)b

    if (!conts.length) {
        log('no result')
        return
    }

    for (let container of conts) {
        if (verbose) {
            container.rels = container.rels.length
            container.morels = container.morels.length
            log('_container', container)
        }

        for (let cdict of container.cdicts) {
            log('_r: rdict', cdict.rdict, cdict.pos, cdict.stem, '_scheme:', cdict.schm)
            log('_r: morphs', cdict.morphs)
            log('_r: cdict.dict', cdict)
        }
    }

    if (verbose == 'cache') {
        // console.log('____run_CDICTS', _.flatten(conts.map(cont=> cont.cdicts)))
        let dictkeys = _.flatten(conts.map(cont=> cont.cdicts.map(cdict=> cdict.dict)))
        dictkeys = _.uniq(dictkeys)
        console.log('____run_dictkeys', dictkeys)

        let cachedicts = await getCacheD(dictkeys)
        console.log('____run_cachedicts', cachedicts)
        let rcacheDs = cachedicts.map(cdict=> cdict.rdict)
        console.log('____run_rcacheDs', rcacheDs)
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
