//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
// import { nameTests } from './lib/makeNameTests.js'
// import { adjTests } from './lib/makeAdjTests.js'

let only = process.argv.slice(10)[0] //  'ἀργυρῷ'


import { prettyName } from '../lib/utils.js'
import { getFile } from './lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

import { nouns } from '../../fetcher/lib/nouns_list.js'
let names = nouns //.map(name=> comb(name))
log('_NAMES', names.length)

names = names // .slice(0, 20)
// log('_NAMES', names)

let tests = []

names = ['ἄγκυρα']

let skip = true
// let files = getFiles(only)
// log('_FNS', files[0])
for (let name of names) {
    if (only == name) skip = false
    // log('_NAME', only, name, only == name)
    if (skip) continue
    let file
    try {
        file = getFile(name)
    } catch(err) {
        continue
    }

    for (let dialect of file.forms) {
        log('_D', dialect)
        for (let form of dialect.forms) {
            tests.push(form.wf)
            if (!cache[form.wf]) cache[form.wf] = []
            for (let gens of dialect.gends) {
                let test = _.clone(form)
                test.gend = gens
                cache[form.wf].push(test)
            }
      }
    }
}

tests = _.uniq(tests)

for (let wf in cache) {
    if (!tests.includes(wf)) continue
    let jsons = cache[wf].map(form=> JSON.stringify(form))
    jsons = _.uniq(jsons)
    // if (wf == 'ἀγαθίς') log('==============', wf, jsons)
    cache[wf] = jsons.map(json=> JSON.parse(json))
}

let conly = comb(only)
log('_CACHE', cache[conly])
// log('_CACHE', cache['ἄγκυρα'])
// log('_CACHE', cache)
// log('_TESTS', tests)


log('_CACHE', cache['ἀγαλλίασις'])

// tests = tests.slice(0,1)

describe('test names:', () => {
    for (let wf of tests) {
        // log('_WF', wf, cache[wf])
        let expected = cache[wf].map(form=> [form.gend, form.num, form.case].join('.')).sort()
        // log('_EXP', wf, expected)
        testWF(wf, expected)
    }
})

async function testWF(wf, exp) {
    it(`wf:  ${wf}`, async () => {
        let chains = await anthrax(wf)
        // log('_EXP', wf.key, exp)
        let chain = chains.find(chain=> chain.find(seg=> seg.mainseg).name) // а если несколько names?
        /* log('_WF', wf) */
        // log('_CHAIN', chains.length, chain)
        let fls = chain.find(seg=> seg.fls).fls
        // log('_FLS', fls)
        // let morphs = fls.
        let morphs = prettyName(fls)
        assert.deepEqual(morphs, exp)
    })
}


// async function testWF(wf, exp) {
//     it(`wf: ${wf.rdict} - ${wf.form} - ${wf.descr}`, async () => {
//         let chains = await anthrax(wf.form)
//         // log('_EXP', wf.key, exp)
//         let chain = chains.find(chain=> chain.find(seg=> seg.mainseg).name)
//         /* log('_WF', wf) */
//         // log('_CHAIN', chains.length, chain)
//         let fls = chain.find(seg=> seg.fls).fls
//         let morphs = prettyName(fls)
//         assert.deepEqual(morphs, exp)
//     })
// }

// describe('test names:', () => {
//     for (let wf of tests) {
//         let wfkey = wf.form
//         wfkey = [wf.dict, wf.form].join('-')
//         let expected = cache[wfkey].sort()
//         wf.key = wfkey
//         testWF(wf, expected)
//     }
// })


function compactNamesFls_(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.filter(flex=> !flex.adv).map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}

function compactNameFls_(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}
