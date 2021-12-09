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

/* tests = tests.slice(0, 50) */
log('T', tests.length)

/* tests = tests.slice(0, 2) */
for (let wf of tests) {
    /* let wfkey = [wf.dict, wf.form].join('-') // plain.form нельзя, ἕδρᾳ - отвалится йота */
    if (!cache[wf.form]) cache[wf.form] = []
    if (wf.verb) cache[wf.form].push([wf.tense, wf.numper].join('-'))
    /* else if (wf.part) cache[wf.form].push([wf.tense, wf.gend].join(' ')) */
    else if (wf.inf) cache[wf.form].push(wf.tense)
}

/* log('_CACHE', cache) */


async function testWF(wf) {
    it(`wf: ${wf.dict} - ${wf.form} - ${wf.gend}`, async () => {
        log(wf)
        if (wf.part) return
        let chains = await anthrax(wf.form)
        let chain = chains[0][0]
        /* log('_chains', wf.form, chain.cdicts) */
        /* log('_fls', chain.cdicts[0].fls) */
        /* log('_cache', cache[wf.form]) */
        let fls = compactVerbFls(chain.cdicts[0].fls)
        let expected = cache[wf.form].sort()
        /* let chain = chains.find(ch=> _.last(ch).cdicts.find(cdict=> cdict.dict == wf.dict)) // last: - heades does not matter for names */
        /* let dict = chain.cdicts.find(dict=> dict.name && dict.gends.includes(wf.gend)) */
        /* let dicts = _.last(chain).cdicts.filter(dict=> dict.name && dict.gends) */
        /* let fls = compactNamesFls(dicts) */
        assert.deepEqual(fls, expected)
    })
}

describe('test names:', () => {
    for (let wf of tests) {
        testWF(wf)
    }
})

function compactVerbFls(fls) {
    return _.uniq(fls.map(flex=> [flex.tense, flex.numper].join('-'))).sort()
}

function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.numcase].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}
