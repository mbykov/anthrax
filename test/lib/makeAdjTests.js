const log = console.log
import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import Debug from 'debug'
const d = Debug('test')

let skip = true

// let cases = ['nom', 'gen', 'dat', 'acc', 'voc']
let descrs = ['dict', 'nom', 'gen', 'dat' , 'acc' , 'voc' , 'adv' , 'caution' ]

const gends = {
    '6': ['masc fem', 'neut', 'masc fem', 'neut', 'masc fem', 'neut' ],
    '9': ['masc', 'fem',  'neut', 'masc', 'fem', 'neut', 'masc', 'fem', 'neut' ]
}

const nums = {
    '6': ['sg', 'sg', 'du', 'du', 'pl', 'pl' ],
    '9': ['sg', 'sg',  'sg', 'du', 'du', 'du', 'pl', 'pl', 'pl' ]
}

let dict, formstr
let res = {}

let rtests = []
let tests = []

export function adjTests(rows, limit) {
    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        row = row.split('#')[0]

        let arr = row.split(': ')
        let descr = arr[0].trim()
        if (!descrs.includes(descr)) continue
        let txt = arr[1].trim()
        let tarr = txt.split(', ')
        let size = tarr.length
        let tgends = gends[size]
        let tnums = nums[size]
        if (descr == 'dict') {
            dict = txt.split('•')[0].trim()
            formstr = txt.split('•')[1].trim()
            res =  {dict: dict, formstr: formstr, lines: []}
            rtests.push(res)
        } else if (size == '6' || size == '9') {
            let str = row.split(':')[1]
            if (!str) continue
            let line = {descr: descr, forms: str.trim().split(', ')}
            res.lines.push(line)

        } else if (descr == 'adv') {
            // tests[dict] = rtests
        } else if (descr == 'caution') {
            tests.pop()
        } else {
            let str = row.split(':')[1]
            if (!str) continue
            let line = {descr: descr, forms: str.trim().split(', ')}
            res.lines.push(line)
        }
    }

    if (limit) rtests = rtests.slice(0, limit)

    for  (let rtest of rtests) {
        if (!rtest.lines) continue
        for  (let line of rtest.lines) {
            let kase = line.descr
            let size = line.forms.length
            let tgends = gends[size]
            let tnums = nums[size]

            line.forms.forEach((forms2, idy) => {
                forms2.split('-').forEach(form => {
                    let gends = tgends[idy]
                    gends.split(' ').forEach(gend => {
                        let num = tnums[idy]
                        let descr = [gend, num, kase].join('.')
                        let test = {dict: rtest.dict, form, descr}
                        tests.push(test)
                    })
                })
            })
        }
    }
    return tests
}
