//

import _  from 'lodash'
import { cleanString } from './lib/utils.js'
import {oxia, comb, plain, strip} from 'orthos'
import fse from 'fs-extra'
import path  from 'path'

import Debug from 'debug'
const d = Debug('dicts')

const currentdir = process.cwd()
// const dbpath = path.resolve(currentdir, '../pouch-anthrax')

// import { createDBs } from './lib/remote.js'

// import { cacheAnthrax } from '@mbykov/anthrax/remote';
import { anthrax } from './anthrax.js'

let wf = process.argv.slice(2)[0] //  'ἀργυρῷ'
// let nocache = !!process.env.NO_CACHE
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

// check greek TODO:
if (!wf) log('no wordform')
// else runGetCache(wf)
else run(verbose)


async function run(verbose) {
    // проверка на greek - хоть один символ
    wf = cleanString(wf)

    let cwf = comb(wf)

    let conts = await anthrax(cwf)
    log('____conts', conts)

    if (!conts.length) {
        log('no result conts')
        return
    }

}

// indecl - ἕνεκα
// noun - βάρακος

console.time("dbcache");

export async function runGetCache(wf) {
    await createDBs()
    wf = cleanString(wf)
    let cwf = oxia(comb(wf))
    // enclitic:::

    let conts = await cacheAnthrax(cwf)

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
    console.timeEnd("dbcache")
}
