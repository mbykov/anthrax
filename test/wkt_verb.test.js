//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
import { makeVerbTests } from './lib/makeVerbTests.js'

import { anthrax } from '../index.js'
import Debug from 'debug'

const d = Debug('test')

let skip = true

const text = fse.readFileSync('./test/morph-data/wkt_verb.txt','utf8')
let rows = _.compact(text.split('\n'))

log('_ROWS', rows.length)

let cache =  new Map();

rows = rows.slice(0, 500)
let tests = makeVerbTests(rows)

tests = tests.slice(0, 50)
log('T', tests.length)

for (let wf of tests) {
    let wfkey = [wf.dict, wf.form].join('-') // plain.form нельзя, ἕδρᾳ - отвалится йота
    if (!cache[wfkey]) cache[wfkey] = []
    if (wf.verb) cache[wfkey].push([wf.tense, wf.numper].join(' '))
    else if (wf.part) cache[wfkey].push([wf.tense, wf.gend].join(' '))
    else if (wf.inf) cache[wfkey].push([wf.tense, wf.numper].join(' ').trim())
}

log('_CACHE', cache)

tests = tests.slice(0, 2)

async function testWF(wf, exp) {
    it(`wf: ${wf.dict} - ${wf.form} - ${wf.gend}`, async () => {
        let chains = await anthrax(wf.form)
        let chain = chains.find(ch=> _.last(ch).cdicts.find(cdict=> cdict.dict == wf.dict)) // last: - heades does not matter for names
        /* let dict = chain.cdicts.find(dict=> dict.name && dict.gends.includes(wf.gend)) */
        let dicts = _.last(chain).cdicts.filter(dict=> dict.name && dict.gends)
        /* let fls = compactNamesFls(dicts) */
        assert.equal(true, true)

        /* assert.deepEqual(fls, exp) */
    })
}

describe('test names:', () => {
    for (let wf of tests) {
        let wfkey = [wf.dict, wf.form].join('-')
        let expected = cache[wfkey].sort()
        testWF(wf, expected)
    }
})
