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
let atests = adjTests(arows, limit)
log('_ATESTS', atests.length)

let tests = ntests.concat(atests)
log('_TESTS', tests.length)

let wfs = []
for (let wf of tests) {
    if (!wf.dict) log('__NO DICT', wf)
    let wfplain = plain(wf.dict)
    let wfkey = [wfplain, wf.form].join('-') // plain.form нельзя, ἕδρᾳ - отвалится йота
    wfkey = wf.form
    /* let wfkey = [plain(wf.dict), plain(wf.form)].join('-') */
    if (!cache[wfkey]) cache[wfkey] = []
    cache[wfkey].push(wf.descr)
}

for (let wfkey in cache) {
    cache[wfkey] = _.uniq(cache[wfkey])
}

/* log('_CACHE', cache['ἄδυτον']) */

/* tests = tests.slice(0,1000) */
/* tests = tests.filter(test => test.form == 'ἄδυτον') */
/* log('_TEST', tests) */
/* tests = [] */

async function testWF(wf, exp) {
    it(`wf: ${wf.dict} - ${wf.form} - ${wf.descr}`, async () => {
        let chains = await anthrax(wf.form)
        log('_CHS', chains)
        log('_CDICTS', wf.dict, chains[0][0].cdicts)
        /* let chain = chains.find(ch=> _.last(ch).cdicts.find(cdict=> cdict.dict == wf.dict && dict.gends.includes(wf.gend))) // last: - heades does not matter for names */
        let chain = chains.find(ch=> _.last(ch).cdicts.find(cdict=> cdict.dict == wf.dict)) // last: - heades does not matter for names
        /* let dict = chain.cdicts.find(dict=> dict.name && dict.gends.includes(wf.gend)) */
        log('_CH', chain)
        let dicts = _.last(chain).cdicts // .filter(dict=> dict.name && dict.gends)
        dicts = dicts.filter(dict=> dict.name) // todo: remove до тестов verb
        let fls = compactNamesFls(dicts)
        assert.deepEqual(fls, exp)
    })
}

describe('test names:', () => {
    for (let wf of tests) {
        let wfplain = plain(wf.dict)
        let wfkey = [wfplain, wf.form].join('-')
        wfkey = wf.form
        /* let wfkey = [plain(wf.dict), plain(wf.form)].join('-') */
        let expected = cache[wfkey].sort()
        testWF(wf, expected)
    }
})


function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.filter(flex=> !flex.adv).map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}

function compactNameFls_(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}
