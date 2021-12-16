//

const log = console.log
import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import Debug from 'debug'
const d = Debug('test')

let skip = true

let res = {}
let dict, formstr, restrict
let numbers = ['sg', 'du', 'pl']

export function nameTests(rows, limit) {
    let ntests = []
    let rtests = []
    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        row = row.split('#')[0]

        let descr = row.split(':')[0].trim()
        if (descr == 'dict') {
            let txt = row.split(':')[1].trim()
            dict = txt.split('•')[0].trim()
            dict = comb(dict)
            formstr = txt.split('•')[1].trim()
            if (!/genitive /.test(formstr)) dict = null // todo: ??? wtf ???
            res =  {dict: dict, formstr: formstr, lines: []}
            parseGend(res)
            rtests.push(res)
        } else if (descr == 'restrict') {
            res.restrict =  row.split(':')[1].trim()
        } else if (['nom', 'gen', 'dat', 'acc', 'voc'].includes(descr)) {
            let str = row.split(':')[1]
            if (!str) continue
            let line = {descr: descr, forms: str.trim().split(', ')}
            res.lines.push(line)
        }
    }
    log('_RTS', rtests.length)
    if (limit) rtests = rtests.slice(0, limit)
    log('_LIMIT', rtests.length)

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
                    rtest.gend.split(' ').forEach(gend=> {
                        let test = {dict: rtest.dict, form, gend: gend, numcase}
                        ntests.push(test)
                    })
                }
            })
        }
    }
    return ntests
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
