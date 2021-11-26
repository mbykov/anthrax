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
let dict

const text = fse.readFileSync('../morph-data/wkt_name.txt','utf8')
const rows = text.split('\n')

if (wordform) anthrax(wordform)
else testNames()

async function testNames() {
    log('_ROWS', rows.length)

    for  (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (/END/.test(row)) skip = true
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        log('_R', row)
        let descr = row.split(':')[0].trim()
        if (descr == 'dict') {
            let txt = row.split(':')[1].trim()
            dict = txt.split('•')[0].trim()
            log('_D', dict)
        }

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
