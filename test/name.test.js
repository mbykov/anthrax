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
// names = ['ἄγκυρα']
// log('_NAMES', names)

let tests = []


let skip = false
if (only) skip = true
// let files = getFiles(only)
// log('_FNS', files[0])
for (let name of names) {
    if (only && only == name) skip = false
    // log('_NAME', only, name, only == name)
    if (skip) continue
    let file
    try {
        file = getFile(name)
    } catch(err) {
        continue
    }

    for (let dialect of file.forms) {
        // log('_D', dialect)
        for (let form of dialect.forms) {
            let wf = form.wf.toLowerCase()
            tests.push(wf)
            // let pwf = plain(form.wf) // нельзя, объединяются разные формы с острым и облеченным ударением, Ἀβδηρίτης
            if (!cache[wf]) cache[wf] = []
            for (let gens of dialect.gends) {
                let test = _.clone(form)
                test.gend = gens
                cache[wf].push(test)
            }
      }
    }
}

tests = _.uniq(tests)

let wf = 'ἀήρ'
let cwf  = comb(wf)
// tests = [cwf]

for (let wf in cache) {
    if (!tests.includes(wf)) continue
    let jsons = cache[wf].map(form=> JSON.stringify(form))
    jsons = _.uniq(jsons)
    // if (wf == 'ἀγαθίς') log('==============', wf, jsons)
    cache[wf] = jsons.map(json=> JSON.parse(json))
}

if (only) {
    let conly = comb(only)
    // let ponly = plain(conly)
    log('_CACHE', only, cache[conly])
    log('_CACHE-AGON', only, cache['αἴρα'])
}

describe('test names:', async () => {
    for (let wf of tests) {
        // log('_TEST WF', wf, '_CACHE:', cache[wf])
        // let pwf = plain(wf)
        let expected = cache[wf].map(form=> [form.gend, form.num, form.case].join('.')).sort()
        // log('_EXP', wf, expected)
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

        let indecls = chains.filter(chain=> chain.find(seg=> seg.indecl))
        for (let chain of indecls) {
            let cmorphs = prettyIndecl(chain)
            morphs.push(...cmorphs)
        }

        // log('_EXP', wf.key, exp)
        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        let names = chains.filter(chain=> chain.find(seg=> seg.mainseg).name)
        names = chains.filter(chain=> chain.find(seg=> seg.mainseg && seg.name && seg.cdicts.find(cdict=> cdict.gends))) // non-adective
        /* log('_WF', wf) */
        for (let chain of names) {
            // log('_CHAIN', chains.length, chain)
            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)
            let cmorphs = prettyName(fls)
            morphs.push(...cmorphs)
        }
        morphs = _.uniq(morphs).sort()
        assert.deepEqual(morphs, exp)
    })
}


function prettyIndecl(chain) {
    let vmorphs = []
    let indseg = chain.find(seg=> seg.indecl)
    for (let cdict of indseg.cdicts) {
        let fls = cdict.fls
        let morphs = ''
        if (cdict.fls) morphs = prettyName(fls)
        // log('_indecl:', cdict.term, morphs)
        vmorphs.push(...morphs)
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
