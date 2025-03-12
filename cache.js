//

import _  from 'lodash'
import { anthrax } from './index.js'
import { cleanString } from './lib/utils.js'
import {oxia, comb, plain, strip} from 'orthos'
import fse from 'fs-extra'
import path  from 'path'


import Debug from 'debug'
const d = Debug('dicts')

const currentdir = process.cwd()
const dbpath = path.resolve(currentdir, '../pouch-anthrax')

import { createDBs } from './lib/remote.js'

import { cacheAnthrax } from '@mbykov/anthrax/remote';

let wf = process.argv.slice(2)[0] //  'ἀργυρῷ'
// let nocache = !!process.env.NO_CACHE

const log = console.log

// check greek TODO:
if (!wf) log('no wordform')
else runGetCache(wf)


// indecl - ἕνεκα
// noun - βάρακος

// const cacheIpath = path.resolve(dbpath, 'cacheI')
// const cacheApath = path.resolve(dbpath, 'cacheA')
// const cacheDpath = path.resolve(dbpath, 'cacheD')
// fse.emptyDirSync(cacheIpath)
// fse.emptyDirSync(cacheApath)
// fse.emptyDirSync(cacheDpath)

console.time("dbcache");

export async function runGetCache(wf) {
    await createDBs()
    wf = cleanString(wf)
    let cwf = oxia(comb(wf))
    // enclitic:::

    let conts = await cacheAnthrax(cwf)

    console.log('_RESULT_anthrax', conts)

    console.timeEnd("dbcache")
}
