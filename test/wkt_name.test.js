//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'

import { anthrax } from '../index.js'
import Debug from 'debug'

const d = Debug('test')
/* let wordform = 'ἄβακος' */
/* anthrax(wordform) */

let skip = true
let dict, formstr, restrict
let numbers = ['sg', 'du', 'pl']

const text = fse.readFileSync('./test/morph-data/wkt_name.txt','utf8')
const rows = text.split('\n')

let cache =  new Map();
let res ={}
let wfs = testNames()

function testNames() {
    let wfs = []
    let rwfs = []
    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        /* if (/END/.test(row)) skip = true */
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        row = row.split('#')[0]
        let descr = row.split(':')[0].trim()
        if (descr == 'dict') {
            let txt = row.split(':')[1].trim()
            dict = txt.split('•')[0].trim()
            d('_D', dict)
            dict = comb(dict)
            formstr = txt.split('•')[1].trim()
            if (!/genitive /.test(formstr)) dict = null // todo: ??? wtf ???
            res =  {dict: dict, formstr: formstr, lines: []}
            parseGend(res)
            rwfs.push(res)
        } else if (descr == 'restrict') {
            res.restrict =  row.split(':')[1].trim()
        } else if (['nom', 'gen', 'dat', 'acc', 'voc'].includes(descr)) {
            let str = row.split(':')[1]
            if (!str) continue
            let line = {descr: descr, forms: str.trim().split(', ')}
            res.lines.push(line)
        }
    }
    log('_RTS', rwfs.length)
    rwfs = rwfs.slice(0, 50)

    for  (let rtest of rwfs) {
        if (!rtest.lines) continue
        for  (let line of rtest.lines) {
            let kase = line.descr
            line.forms.forEach((form2, idx) => {
                if (!form2) return
                let forms = form2.split('-')
                for  (let form of forms) {
                    if (!form) continue
                    let number = numbers[idx]
                    if (rtest.pl) number = 'pl'
                    if (rtest.restrict) number = rtest.restrict.split(' ')[idx]
                    let numcase = [number, kase].join('.')
                    rtest.gend.split(' ').forEach(gend=> {
                        let test = {dict: rtest.dict, form, gend: gend, numcase}
                        wfs.push(test)
                    })
                }
            })
        }
    }
    return wfs
}


/* wfs = wfs.slice(0, 20) */
/* log('_WFS', wfs) */

for (let wf of wfs) {
    let wfkey = [wf.dict, wf.form].join('-')
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
        let wfkey = [wf.dict, wf.form].join('-')
        let expected = cache[wfkey]
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
    return _.flatten(fls)
}

function parseGend(res) {
    let head = res.formstr
    if (!head) return
    let gend
    if (head.split(' m f ').length > 1) gend = 'masc fem'
    else if (head.split(' m ').length > 1) gend = 'masc'
    else if (head.split(' f ').length > 1) gend = 'fem'
    else if (head.split(' n ').length > 1) gend = 'neut'
    if (head.split(' pl ').length > 1) res.pl = true
    res.gend = gend
}
