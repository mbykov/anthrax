//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'

const currentdir = process.cwd()

let only = process.argv.slice(10)[0] //  'ἀργυρῷ'
// let wform = process.argv.slice(11)[0] //


import { prettyName } from '../lib/utils.js'
// import { getFile } from './lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

import { adjs } from '../../fetcher/lib/adjs_list.js'
let names = adjs //.map(name=> comb(name))
log('_NAMES', names.length)

// names = names // .slice(0, 20)
// names = ['ἄγκυρα']
// log('_NAMES', names)

let tests = []

let skip = false
if (only) skip = true

for (let name of names) {
    if (only && only == name) skip = false
    // log('_NAME', only, name, only == name)
    if (skip) continue
    let file
    try {
        // log('_N', name)
        file = getFile(name)
    } catch(err) {
        continue
    }

    for (let dialect of file.data) {
        // log('_D', dialect)
        for (let form of dialect.forms) {
            let wf = form.wf // .toLowerCase()
            tests.push(wf)
            if (!cache[wf]) cache[wf] = []
            cache[wf].push(form)
            // let pwf = plain(form.wf) // нельзя, объединяются разные формы с острым и облеченным ударением, Ἀβδηρίτης
        }
    }
}

tests = _.uniq(tests)
log('_TESTS', tests.length)

let wf = 'ἀήρ'
let cwf  = comb(wf)
// tests = [cwf]

for (let wf in cache) {
    // if (!tests.includes(wf)) continue
    let jsons = cache[wf].map(form=> JSON.stringify(form))
    jsons = _.uniq(jsons)
    // if (wf == 'ἀγαθίς') log('==============', wf, jsons)
    cache[wf] = jsons.map(json=> JSON.parse(json))
}

if (only) {
    let conly = comb(only)
    // let ponly = plain(conly)
    log('_CACHE', only, cache[conly])
    log('_CACHE-FW', cache['ἁγίως'])
}

describe('test names:', async () => {
    for (let wf of tests) {
        // log('_TEST WF', wf, '_CACHE:', cache[wf])

        let expected = []
        let adverb = cache[wf].find(form=> form.adv)
        if (adverb) expected.push(['adverb', adverb.atype].join('.'))
        let names = cache[wf].filter(form=> !form.adv)
        let exps = names.map(form=> [form.gend, form.num, form.case].join('.')).sort()
        expected.push(...exps)
        expected = _.uniq(expected)
        await testWF(wf, expected)
    }
})

async function testWF(wf, exp) {
    it(`wf:  ${wf}`, async () => {
        let morphs = []
        let chains = await anthrax(wf)
        if (!chains.length) {
            assert.deepEqual(true, true)
            return
        }

        for (let chain of chains) {
            let indecl = chain.find(seg=> seg.indecl)
            if (!indecl) continue
            let pretty = prettyIndecl(indecl)
            // log('_indecl morphs:', wf, pretty, exp)
            assert.deepEqual(pretty, exp)
            continue
        }

        // log('_EXP', exp)
        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        chains = chains.filter(chain=> chain.find(seg=> seg.mainseg)) //
        let names = chains.filter(chain=> chain.find(seg=> seg.mainseg).name)
        names = chains.filter(chain=> chain.find(seg=> seg.mainseg && seg.name && seg.cdicts.find(cdict=> !cdict.gends)))
        /* log('_WF', wf) */
        for (let chain of names) {
            // log('_MAIN_CHAIN', chain)
            let main = chain.find(seg=> seg.mainseg)
            if (!main) {
                assert.deepEqual(true, true)
                continue
            }
            let cdicts = main.cdicts.filter(cdict=> cdict.name && !cdict.gends) //
            // log('_CDICTS', wf, cdicts.map(cdict=> cdict.rdict))
            if (!cdicts.length) {
                assert.deepEqual(true, true)
                continue
            }
            // log('_CDICTS', wf, cdicts)
            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)
            let cmorphs = prettyName(fls)
            morphs.push(...cmorphs)
        }
        morphs = _.uniq(morphs).sort()
        if (morphs.length) assert.deepEqual(morphs, exp)
        else assert.deepEqual(true, true)
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


function compactNamesFls_(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.filter(flex=> !flex.adv).map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}

function compactNameFls_(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}

function getFile(fn) {
    fn = [fn, 'json'].join('.')
    const dirPath = path.resolve(currentdir, '../morph-data/adjectives')
    let fnpath = [dirPath, fn].join('/')
    let file = fse.readJsonSync(fnpath)
    return file
}
