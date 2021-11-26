//

import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';

import { anthrax } from '../index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
/* wordform = 'ἄβακος' */
/* anthrax(wordform) */

const log = console.log
let skip = true
let dict, formstr, restrict
let numbers = ['sg', 'du', 'pl']

const text = fse.readFileSync('../morph-data/wkt_name.txt','utf8')
const rows = text.split('\n')

let res ={}
if (wordform) anthrax(wordform)
else testNames()

async function testNames() {
    log('_ROWS', rows.length)

    let rtests = []
    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (/END/.test(row)) skip = true
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        /* log('_R', row) */
        let descr = row.split(':')[0].trim()
        if (descr == 'dict') {
            res ={}
            let txt = row.split(':')[1].trim()
            dict = txt.split('•')[0].trim()
            log('_D', dict)
            formstr = txt.split('•')[1].trim()
            if (!/genitive /.test(formstr)) dict = null // todo: ??? зачем ???
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
        rtests.push(res)
        log('_R', res)
    }
    log('_RTS', rtests.length)

    let tests = []
    for  (let rtest of rtests) {
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
                    tests.push(test)
                }
            })
        }
    }
    log('_TESTS', tests.length, tests[0])
    tests = tests.slice(0, 20)
    /* log('T', tests) */
    /* tests = [] */

    for await (let test of tests) {
        let res = await anthrax(test.form)
        log('_RES', res)
    }


}



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
