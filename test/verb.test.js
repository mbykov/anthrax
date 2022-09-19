//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
import { makeVerbTests } from './lib/makeVerbTests.js'

import { prettyVerb } from '../lib/utils.js'

import { anthrax } from '../index.js'
import Debug from 'debug'

const d = Debug('test')

let skip = true

const text = fse.readFileSync('./test/morph-data/wkt_verb.txt','utf8')
let rows = _.compact(text.split('\n'))

log('_ROWS', rows.length)

let cache =  new Map();

rows = rows.slice(0, 1500)
let tests = makeVerbTests(rows)

tests = tests.slice(0, 1500)
log('TESTS', tests.length)
// tests = []

for (let test of tests) {
    // log('_test', test)
    if (!cache[test.form]) cache[test.form] = []
    if (test.verb) cache[test.form].push([test.tense, test.numper].join(', '))
    // else if (wf.part) cache[wf.form].push([wf.tense, [wf.gend, 'sg.nom'].join('.')].join(', '))
    // else if (wf.inf) cache[wf.form].push(wf.tense)
}

log('_CACHE', cache['ἀγαθοεργεῖτον'])
log('_CACHE', _.keys(cache).length)


async function testWF(wf, exp) {
    it(`wf ${wf} - ${exp}`, async () => {
        let chains = await anthrax(wf)
        // log('_WF', wf, expected)
        for await (let chain of chains) {
            // log('_WF', wf)
            let chains = await anthrax(wf)
            // log('_EXP', wf.key, exp)
            let chain = chains.find(chain=> chain.find(seg=> seg.mainseg).verb)
            // log('_CHAIN', chains.length, chain)
            let fls = chain.find(seg=> seg.fls).fls
            let morphs = prettyVerb(fls)
            morphs = JSON.stringify(morphs)
            assert.deepEqual(morphs, exp)
        }
    })
}

describe('test verbs:', () => {
    for (let form in cache) {
        let expected = JSON.stringify(cache[form].sort())
        // log('_form', form, expected)
        testWF(form, expected)
    }
})
