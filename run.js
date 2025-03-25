//

import _  from 'lodash'

import { anthrax } from './index.js'
// import { anthrax } from './anthrax.js'

import { cleanString } from './lib/utils.js'
import {oxia, comb, plain, strip} from 'orthos'

import Debug from 'debug'
const d = Debug('dicts')

// import { createDBs } from './lib/remote.js'

let wf = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

// check greek TODO:
if (!wf) log('no wordform')
else run(verbose)

let nocache = !!process.env.NO_CACHE

// обнулить Indecls
//  rm -rf ../pouch-anthrax/cacheI

async function run(verbose) {
    // await createDBs()
    // проверка на greek - хоть один символ
    wf = cleanString(wf)
    let cwf = comb(wf)

    // TODO: отдельно - сначала indecl-DB
    let conts = await anthrax(cwf)
    // log('____conts', conts)

    if (!conts.length) {
        log('no result conts')
        return
    }

    for (let container of conts) {
        for (let cdict of container.cdicts) {
            log('_r: rdict', cdict.rdict, cdict.pos, cdict.stem, '_scheme:', cdict.schm)
            log('_r: morphs', cdict.morphs)
            if (verbose) {
                container.rels = container.rels.length
                container.morels = container.morels.length
                // log('_container', container)
                log('_r: cdict', cdict)
                log('_trns', cdict.trns)
            }
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
