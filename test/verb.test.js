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

import { prettyVerb } from '../lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

import { verbs } from '../../fetcher/lib/verbs_list.js'
let names = verbs //.map(name=> comb(name))
log('_NAMES', names.length)

// names = names // .slice(0, 20)
// names = ['ἀναβλέπω']
// log('_NAMES', names)

let tests = []

let skip = false
if (only) skip = true

for (let name of names) {
    if (only && only == name) skip = false
    if (skip) continue
    let file
    try {
        file = getFile(name)
        // log('_F', file)
    } catch(err) {
        continue
    }

    for (let vtime of file.vtimes) {
        // log('_D', vtime)
        for (let form of vtime.forms) {
            let wf = form.wf // .toLowerCase()
            tests.push(wf)
            if (!cache[wf]) cache[wf] = []
            form.time = vtime.info.time
            let tense = [vtime.info.time, form.voice, form.mood].join('.')
            let numper = [form.number, form.person].join('.')
            let res = [tense, numper].join(', ')
            cache[wf].push(res)
            // let pwf = plain(form.wf) // нельзя, объединяются разные формы с острым и облеченным ударением, Ἀβδηρίτης
        }
    }
}

tests = _.uniq(tests)
log('_TESTS', tests.length)

// let wf = 'ἀναβλέπω'
// let cwf  = comb(wf)
// tests = [cwf]

for (let wf in cache) {
    cache[wf] = _.uniq(cache[wf])
}

if (only) {
    let conly = comb(only)
    log('_CACHE', only, cache[conly])
    log('_CACHE-FW', cache['ἁγίως'])
}

describe('test names:', async () => {
    for (let wf of tests) {
        let expected = cache[wf].sort()
        await testWF(wf, expected)
    }
})

async function testWF(wf, exp) {
    it(`wf:  ${wf}`, async () => {
        // log('_TEST', wf, exp)
        let morphs = []
        let chains = await anthrax(wf)
        if (!chains.length) {
            assert.deepEqual(true, true)
            return
        }

        for (let chain of chains) {
            // let indecl = chain.find(seg=> seg.indecl)
            // if (!indecl) continue
            // let pretty = prettyIndecl(indecl)
            // assert.deepEqual(pretty, exp)
            // continue
        }

        // log('_EXP', exp)
        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        // chains = chains.filter(chain=> chain.find(seg=> seg.mainseg)) //
        // let names = chains.filter(chain=> chain.find(seg=> seg.mainseg).name)
        // let names = chains.filter(chain=> chain.find(seg=> seg.mainseg && seg.verb && seg.cdicts.find(cdict=> !cdict.gends)))
        let verbchains = chains.filter(chain=> chain.find(seg=> seg.mainseg && seg.verb))
        /* log('_WF', wf) */
        for (let chain of verbchains) {
            // log('_MAIN_CHAIN', chain)
            let main = chain.find(seg=> seg.mainseg)
            if (!main) {
                assert.deepEqual(true, true)
                continue
            }
            let cdicts = main.cdicts.filter(cdict=> cdict.verb)
            // log('_CDICTS', wf, cdicts.map(cdict=> cdict.rdict))
            if (!cdicts.length) {
                assert.deepEqual(true, true)
                continue
            }
            // log('_CDICTS', wf, cdicts)
            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)
            let cmorphs = prettyVerb(fls)
            morphs.push(...cmorphs)
        }
        morphs = _.uniq(morphs).sort()
        assert.deepEqual(morphs, exp)
    })
}


function prettyIndecl(indecl) {
    let vmorphs = []
    for (let cdict of indecl.cdicts) {
        let morphs = ''
        if (cdict.fls) {
            let morphs = prettyName(cdict.fls)
            vmorphs.push(...morphs)
        } else if (cdict.adv) {
            let advmorph = ['adverb', cdict.atype].join('.')
            vmorphs.push(advmorph)
            // log('_indecl:', cdict.term, morphs)
        }
    }
    return _.uniq(vmorphs).sort()
}

function getFile(fn) {
    fn = [fn, 'json'].join('.')
    const dirPath = path.resolve(currentdir, '../morph-data/verbs')
    let fnpath = [dirPath, fn].join('/')
    let file = fse.readJsonSync(fnpath)
    return file
}
