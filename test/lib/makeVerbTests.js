//

const log = console.log
import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

let skip = true

export function makeVerbTests(rows, only) {
    let pars = parseText(rows, only)
    pars = pars.slice(0, 4)
    parsePars (pars, only)

    let tests = []
    return tests
}

function parsePars (pars, only)  {
    for (let par of pars) {
        log('_P', par)

    }
}

function parseText (rows, only) {
    rows = rows.slice(0, 500)
    let pars = []
    let rdict, dict, pres, futs, trns, trn
    let formstr, futstr
    let mark
    let store = []
    let parts = []
    let infs = []
    for (let row of rows) {
        if (/MA/.test(row)) skip = false
        if (skip) continue
        if (!row || row.slice(0,2) == '# ') continue
        /* if (!row[0] == ' ') trn = row.trim() */
        row = row.split(' # ')[0]
        let descr = row.split(':')[0].trim()

        if (row.slice(0,2) == '#=' || descr == 'dict') {
            if (mark && formstr) {
                let res =  {pos: mark, rdict, dict, formstr, data: store, parts, infs} // , trns: trns // TRNS, STORE
                let cres = _.clone(res)
                if (mark == 'pres') cres.trns = trns
                pars.push(cres)
            }
            store = []
            parts = []
            infs = []
            mark = null
        }

        if (descr == 'dict') {
            let txt = row.split(':')[1].trim()
            rdict = txt.split('•')[0].trim()
            dict = comb(rdict)
            trns = []
        } else if (/Present/.test(descr)) {
            if (!row.split(':')[1]) log('ROW', row)
            formstr = row.split(':')[1].trim()
            mark = 'pres'
        } else if (/Imperfect/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'impf'
        } else if (/Aorist/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'aor'
        } else if (/Future/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'fut'
        } else if (/inf/.test(descr)) {
            let str = row.split(':')[1]
            if (!str) continue
            str = str.trim()
            let forms = str.split(', ')
            let part = {descr: descr, forms: forms}
            infs.push(part)
        } else if (/\.part/.test(descr)) {
            let str = row.split(':')[1]
            if (!str) continue
            str = str.trim()
            let forms = str.split(', ')
            let part = {descr: descr, forms: forms}
            parts.push(part)
        } else  if (/act\./.test(descr) || /mp\./.test(descr) || /mid\./.test(descr) || /pas\./.test(descr)) {
            // descr = descr.replace('mp.', 'mid.')
            let str = row.split(':')[1]
            if (!str) continue
            let res = {descr: descr, forms: str.trim().split(', ')}
            store.push(res)
        } else if (row[0] == ' ') {
            if (trns) trns.push(row.trim())
        }
    }
    return pars

}
