//

const log = console.log
import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

let skip = true
const numpers = "sg.1 sg.2 sg.3 du.2 du.3 pl.1 pl.2 pl.3".split(' ')

export function makeVerbTests(rows, only) {
    let pars = parseText(rows, only)
    pars = pars.slice(0, 4)
    let tests = parsePars (pars, only)
    return tests
}

function parsePars (pars, only)  {
    let tests = []
    for (let par of pars) {
        /* log('_P', par) */
        let descrs = par.data.map(line => { return line.descr })
        descrs = _.uniq(descrs)
        let voices = descrs.map(descr => { return descr.split('.')[0] })
        voices = _.uniq(voices)

        par.data.forEach(line => {
            line.forms.forEach((form2, idy) => {
                if (!form2) return
                form2.split('-').forEach(form => {
                    if (!form) return
                    let numper = numpers[idy]
                    /* let test = ['verb', par.rdict, form, line.descr, numper] */
                    let test = {verb: true, dict: par.dict, form, tense: line.descr, numper}
                    tests.push(test)
                })
            })
        })

        let nums = ['sg', 'du', 'pl']
        par.parts.forEach(line => {
            return
            let descrs = line.descr.split('-')
            let rdescr = descrs[0]
            let gend = descrs[1]
            line.forms.forEach((form2, idy) => {
                if (!form2) return
                form2.split('-').forEach(form => {
                    if (!form) return
                    let voice = voices[idy]
                    let descr
                    if (rdescr.split('.').length == 3) descr = rdescr
                    else descr = [voice, rdescr].join('.')
                    /* let test = ['part', par.rdict, form, descr, gend] */
                    let test = {part: true, dict: par.dict, form, tense: descr, gend}
                    tests.push(test)
                })
            })
        })

        par.infs.forEach(line => {
            return
            line.forms.forEach((form2, idy) => {
                if (!form2) return
                form2.split('-').forEach(form => {
                    if (!form) return
                    voices.forEach(voice => {
                        let descr
                        if (line.descr.split('.').length == 3) descr = line.descr
                        else descr = [voice, line.descr].join('.')
                        /* let test = ['inf', par.rdict, form, descr, '-'] */
                        let test = {inf: true, dict: par.dict, form, tense: descr}
                        tests.push(test)
                    })
                })
            })
        })
    }
    return tests
}

function parseText (rows, only) {
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
