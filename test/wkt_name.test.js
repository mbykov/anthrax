//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';

import { anthrax } from '../index.js'
import Debug from 'debug'

const d = Debug('test')

/* let wordform = 'ἄβακος' */
/* anthrax(wordform) */

let skip = true
let dict, formstr, restrict
let numbers = ['sg', 'du', 'pl']

const text = fse.readFileSync('../morph-data/wkt_name.txt','utf8')
const rows = text.split('\n')

let res ={}
let wfs = testNames()

function testNames() {
    let wfs = []
    let rwfs = []
    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (/END/.test(row)) skip = true
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        let descr = row.split(':')[0].trim()
        if (descr == 'dict') {
            res ={}
            let txt = row.split(':')[1].trim()
            dict = txt.split('•')[0].trim()
            d('_D', dict)
            formstr = txt.split('•')[1].trim()
            if (!/genitive /.test(formstr)) dict = null // todo: ??? wtf ???
            res =  {dict: dict, formstr: formstr, lines: []}
            parseGend(res)
        } else if (descr == 'restrict') {
            res.restrict =  row.split(':')[1].trim()
        } else if (['nom', 'gen', 'dat', 'acc', 'voc'].includes(descr)) {
            let str = row.split(':')[1]
            if (!str) continue
            let line = {descr: descr, forms: str.trim().split(', ')}
            res.lines.push(line)
        }
        rwfs.push(res)
        d('_R', res)
    }
    d('_RTS', rwfs.length)

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
                    /* let test = [rtest.dict, form, rtest.gend, numcase] */
                    let test = {dict: rtest.dict, form, gend: rtest.gend, numcase}
                    wfs.push(test)
                }
            })
        }
    }
    return wfs
}

log('_WFS', wfs.length)
wfs = wfs.slice(0, 2)
/* wfs = [] */

describe("names test", function() {
    for (let wf of wfs) {
        test('the data is peanut butter', async () => {
            let chains = await anthrax(wf.form)
            let chain = chains[0] // first chain
            let dictseg = _.last(chain)
            let cdicts = dictseg.cdicts
            let names = cdicts.filter(dict=> dict.name)
            log('_WF', wf)
            log('_RES', names)
            let gendnames = names.filter(dict=> dict.gends.includes(wf.gend))
            expect(gendnames.length).toBeGreaterThan(0)
            gendnames.forEach(dict => {
                let fls = dict.fls
                let numcases = dict.flexes.map(flex => { return flex.numcase })
                /* log('_NK', numcases) */
                expect(numcases.includes(wf.numcase)).toBe(true);
            })

        });
    }

});

function parseGend(res) {
    let head = res.formstr
    if (!head) return
    let gend
    if (head.split(' m ').length > 1) gend = 'masc'
    else if (head.split(' f ').length > 1) gend = 'fem'
    else if (head.split(' n ').length > 1) gend = 'neut'
    else if (head.split(' m f ').length > 1) gend = 'masc fem'
    if (head.split(' pl ').length > 1) res.pl = true
    res.gend = gend
}
