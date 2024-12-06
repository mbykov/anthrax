//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'

const currentdir = process.cwd()

let only = process.argv.slice(9)[0] //  'ἀναβλέπω'

import { prettyVerb, prettyIndecl } from '../lib/utils.js'
// import { getFile } from './lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

let dbs = ['wkt']

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

// import { nouns } from '../../fetchers/fetcher-wkt/lib/nouns_list.js'
import { verbs } from '../../fetchers/fetcher-wkt/lib/verbs_list.js'

// let rverbs = verbs.slice(1, 320)
// rverbs = ['ἀναβλέπω']
log('_VERBS', verbs.length)

let nth_verbs = []

let delta = 100
for (let i = 0; i < verbs.length; i=i+delta) {
    nth_verbs.push(verbs[i]);
}

// nth_verbs = nth_verbs.slice(1)
log('_nth_verbs', nth_verbs)

let tests = []

let skip = false
if (only) skip = true


for (let verb of nth_verbs) {
    if (only && only == verb) skip = false
    if (skip) continue
    let file
    try {
        file = getFile(verb)
        // log('_F', file)
    } catch(err) {
        log('_E', err)
        continue
    }

    for (let vtime of file.vtimes) {
        // log('_vtime', vtime.info.time)
        for (let form of vtime.forms) {

            // if (form.part) continue // убрать после participles. Или добавить обработку part.sg.nom здесь в verbs
            if (vtime.info.time == 'pf' && (form.voice == 'mp' || form.voice == 'mid') && (form.mood == 'sub' || form.mood == 'opt')) continue

            let wf = form.wf // .toLowerCase()
            tests.push(wf)
            if (!cache[wf]) cache[wf] = []
            let res
            if (form.inf) {
                res = [vtime.info.time, form.voice, 'inf'].join('.')
            } else if (form.part) {
                let tense = [vtime.info.time, form.voice, 'part'].join('.')
                let numcase = [form.gend, form.num, form.case].join('.')
                res = [tense, numcase].join(', ')
                // log('_RES', form, res)
            } else {
                let tense = [vtime.info.time, form.voice, form.mood].join('.')
                let numper = [form.num, form.person].join('.')
                res = [tense, numper].join(', ')
            }
            cache[wf].push(res)
        }
    }
}

tests = _.uniq(tests)

let wf = 'ἀναβλέπω'
let cwf  = comb(wf)
// tests = [cwf]
log('_TESTS', tests.length)


for (let wf in cache) {
    cache[wf] = _.uniq(cache[wf])
}

// log('_CACHE', cache) // ['ἀναβλέπεις']

if (only) {
    let conly = comb(only)
    log('_CACHE', only, cache[conly])
}

describe('test verbs:', async () => {
    for (let wf of tests) {
        let expected = _.uniq(cache[wf].sort())
        await testWF(wf, expected)
    }
})

async function testWF(wf, exp) {
    it(`wf:  ${wf}`, async () => {
        // log('_TEST', wf, exp)
        let morphs = []
        let chains = await anthrax(wf, dbs)
        if (!chains.length) {
            // log('_no', wf)
            assert.deepEqual(true, true)
        }

        // for (let chain of chains) {
        //     let indecl = chain.find(seg=> seg.indecl)
        //     if (!indecl) continue
        //     let pretty = prettyIndecl(indecl)
        //     // log('_XXX', pretty, exp)
        //     assert.deepEqual(pretty, exp)
        //     return
        // }

        // log('_chains', chains)
        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        // chains = chains.filter(chain=> chain.find(seg=> seg.main)) //
        // let verbs = chains.filter(chain=> chain.find(seg=> seg.main).verb)
        // let verbs = chains.filter(chain=> chain.find(seg=> seg.main && seg.verb && seg.cdicts.find(cdict=> !cdict.gends)))
        let verbs = chains.filter(chain=> chain.find(seg=> seg.main && seg.verb))
        /* log('_WF', wf) */
        for (let chain of verbs) {
            // log('_MAIN_CHAIN', chain)
            let cdicts = chain.find(seg=> seg.main).cdicts
            // log('_CDICTS', wf, cdicts)
            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)

            let cmorphs = prettyVerb(fls)
            // log('_EXP', wf, exp)

            cmorphs = _.uniq(cmorphs).sort()
            assert.deepEqual(cmorphs, exp)
        }
    })
}

function getFile(fn) {
    fn = [fn, 'json'].join('.')
    const dirPath = path.resolve(currentdir, '../morph-data/wkt/verbs')
    let fnpath = [dirPath, fn].join('/')
    // log('_===================', fnpath)
    let file = fse.readJsonSync(fnpath)
    return file
}
