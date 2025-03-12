//

import _  from 'lodash'
import { anthrax } from './index.js'
import { cleanString } from './lib/utils.js'
import {oxia, comb, plain, strip} from 'orthos'

import Debug from 'debug'
const d = Debug('dicts')

import { createDBs, getFlexes, getCacheD, getCacheI } from './lib/remote.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

// check greek TODO:
if (!wordform) log('no wordform')
else run(verbose)

let nocache = !!process.env.NO_CACHE

// обнулить Indecls
//  rm -rf ../pouch-anthrax/cacheI

async function run(verbose) {
    await createDBs()
    // проверка на greek - хоть один символ
    wordform = cleanString(wordform)

    let cwf = comb(wordform)
    // let indecls = await getCacheI(cwf)
    // log('______________________________________indecls', indecls)

    // TODO: отдельно - сначала indecl-DB
    let conts = await anthrax(wordform)
    // log('____conts', conts)

    if (!conts.length) {
        log('no result conts')
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
