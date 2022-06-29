//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
import { makeVerbTests } from './lib/makeVerbTests.js'
import { prettyVerbRes } from '../lib/utils.js'

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

/* tests = [] */
tests = tests.slice(0, 2)
log('TESTS', tests)


for (let wf of tests) {
    /* let wfkey = [wf.dict, wf.form].join('-') // plain.form нельзя, ἕδρᾳ - отвалится йота */
    if (!cache[wf.form]) cache[wf.form] = []
    if (wf.verb) cache[wf.form].push([wf.tense, wf.numper].join(', '))
    /* else if (wf.part) cache[wf.form].push([wf.tense, wf.gend].join(' ')) */
    // else if (wf.inf) cache[wf.form].push(wf.tense)
}

log('_CACHE', cache['ἀγαθοεργέω'])
log('_CACHE', _.keys(cache).length)


async function testWF(wf, expected) {
    it(`wf ${wf} - ${expected}`, async () => {
        let chains = await anthrax(wf)
        // log('_WF', wf, expected)
        let idx = 0
        for await (let chain of chains) {
            let pr = prettyVerbRes(chain)
            let exp = expected[idx]
            // let segs = comb(exp.segs)
            idx++
            // log('_pr.fls:', typeof pr.fls)
            // let fls = JSON.stringify(pr.fls.sort())
            assert.equal(pr.fls, expected)
        }
    })
}

describe('test verbs:', () => {
    for (let form in cache) {
        // log('_f', form)
        let expected = JSON.stringify(cache[form].sort())
        testWF(form, expected)
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
