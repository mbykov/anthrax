//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
import { nameTests } from './lib/makeNameTests.js'
import { adjTests } from './lib/makeAdjTests.js'

import { prettyName } from '../lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

/* let wordform = 'ἄβακος' */
/* anthrax(wordform) */

let skip = true
/* let dict, formstr, restrict */
/* let numbers = ['sg', 'du', 'pl'] */

const ntext = fse.readFileSync('./test/morph-data/wkt_name.txt','utf8')
const nrows = ntext.split('\n')

const atext = fse.readFileSync('./test/morph-data/wkt_adj.txt','utf8')
let arows = atext.split('\n')

let cache =  new Map();
/* let res = {} */

let limit = 0

let ntests = nameTests(nrows, limit)
log('_NTESTS', ntests.length)
// let atests = adjTests(arows, limit)
// log('_ATESTS', atests.length)

// let tests = ntests.concat(atests)
let tests = ntests

// tests = tests.slice(0,2)
log('_TESTS', tests.length)
/* tests = [] */

// let wfs = []
for (let wf of tests) {
    if (!wf.dict) log('__NO DICT', wf)
    let wfkey = wf.form
    wfkey = [wf.dict, wf.form].join('-')
    if (!cache[wfkey]) cache[wfkey] = []
    cache[wfkey].push(wf.descr)
}

for (let wfkey in cache) {
    cache[wfkey] = _.uniq(cache[wfkey])
}

/* log('_CACHE', cache['ἀλαζών-ἀλαζόνε']) */

async function testWF(wf, exp) {
    it(`wf: ${wf.rdict} - ${wf.form} - ${wf.descr}`, async () => {
        let chains = await anthrax(wf.form)
        // log('_EXP', wf.key, exp)
        let chain = chains.find(chain=> chain.find(seg=> seg.mainseg).name)
        /* log('_WF', wf) */
        // log('_CHAIN', chains.length, chain)
        let fls = chain.find(seg=> seg.fls).fls
        let morphs = prettyName(fls)
        assert.deepEqual(morphs, exp)
    })
}

describe('test names:', () => {
    for (let wf of tests) {
        let wfkey = wf.form
        wfkey = [wf.dict, wf.form].join('-')
        let expected = cache[wfkey].sort()
        wf.key = wfkey
        testWF(wf, expected)
    }
})


function compactNamesFls_(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.filter(flex=> !flex.adv).map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}

function compactNameFls_(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}
