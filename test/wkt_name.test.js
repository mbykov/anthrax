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

/* let ntests = nameTests(nrows, 2) */
/* log('_NTESTS', ntests) */


let atests = adjTests(arows, 2)
log('_ATESTS', atests.length)


/* let wfs = testNames() */

let wfs = []
for (let wf of wfs) {
    let wfplain = plain(wf.dict)
    let wfkey = [wfplain, wf.form].join('-') // plain.form нельзя, ἕδρᾳ - отвалится йота
    wfkey = wf.form
    /* let wfkey = [plain(wf.dict), plain(wf.form)].join('-') */
    if (!cache[wfkey]) cache[wfkey] = []
    cache[wfkey].push([wf.gend, wf.numcase].join('.'))
}

/* log('_CACHE', cache) */

async function testWF(wf, exp) {
    it(`wf: ${wf.dict} - ${wf.form} - ${wf.gend}`, async () => {
        let chains = await anthrax(wf.form)
        let chain = chains.find(ch=> _.last(ch).cdicts.find(cdict=> cdict.dict == wf.dict)) // last: - heades does not matter for names
        /* let dict = chain.cdicts.find(dict=> dict.name && dict.gends.includes(wf.gend)) */
        let dicts = _.last(chain).cdicts.filter(dict=> dict.name && dict.gends)
        let fls = compactNamesFls(dicts)
        assert.deepEqual(fls, exp)
    })
}

describe('test names:', () => {
    for (let wf of wfs) {
        let wfplain = plain(wf.dict)
        let wfkey = [wfplain, wf.form].join('-')
        wfkey = wf.form
        /* let wfkey = [plain(wf.dict), plain(wf.form)].join('-') */
        let expected = cache[wfkey].sort()
        testWF(wf, expected)
    }
})


function compactNameFls(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.numcase].join('.')))
}

function compactNamesFls(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.map(flex=> [flex.gend, flex.numcase].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}
