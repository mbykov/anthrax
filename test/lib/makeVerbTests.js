//

const log = console.log
import _ from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

let skip = true
const numpers = "sg.1 sg.2 sg.3 du.2 du.3 pl.1 pl.2 pl.3".split(' ')

export function makeVerbTests(rows, only) {
    let pars = parseText(rows, only)

    // pars = pars.slice(0, 2)
    // log('_P', pars[0].data)
    // return []
    let tests = parsePars (pars, only)
    return tests
}

function parsePars (pars, only)  {
    let tests = []
    for (let par of pars) {
        // log('_P', par)
        let tenses = par.verbs.map(line => { return line.tense })
        tenses = _.uniq(tenses)
        let voices = tenses.map(descr => { return descr.split('.')[0] })
        voices = _.uniq(voices)
        // log('_V', voices)

        par.verbs.forEach(line => {
            // log('_L', line)
            line.forms.forEach((form2, idy) => {
                if (!form2) return
                form2.split('-').forEach(form => {
                    if (!form) return
                    let numper = numpers[idy]
                    // let descrs = line.tense.split('.')
                    // let tense = [descrs[0], par.time, descrs[1]].join('.')
                    let test = {verb: true, dict: par.dict, form, tense: line.tense, numper}
                    tests.push(test)
                })
            })
        })

        let nums = ['sg', 'du', 'pl']
        par.parts.forEach(line => {
            let descrs = line.tense.split('-')
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
                    let test = {part: true, dict: par.dict, form, tense: descr, gend}
                    tests.push(test)
                })
            })
        })

        par.infs.forEach(line => {
            line.forms.forEach((form2, idy) => {
                if (!form2) return
                form2.split('-').forEach(form => {
                    if (!form) return
                    voices.forEach(voice => {
                        let descr
                        if (line.tense.split('.').length == 3) descr = line.tense
                        else descr = [voice, line.tense].join('.')
                        let test = {inf: true, dict: par.dict, form, tense: descr}
                        tests.push(test)
                    })
                })
            })
        })
    }
    return tests
}


function parseText (rows) {
    let pars = []
    let rdict, dict, pdict, type, pres, futs, trns, trn, aug, voice
    let formstr
    let mark
    let store = []
    let parts = []
    let infs = []
    rows.forEach((row, idx) => {
        // if (idx > 147) return

        if (/MA/.test(row)) skip = false
        if (skip) return
        if (!row || row.slice(0,2) == '# ') return
        if (!row[0] == ' ') trn = row.trim()
        let descr = row.split(':')[0].trim()

        if (row.slice(0,2) == '#=' || descr == 'dict') {
            if (mark && formstr) {
                // let forms = formstr.split('(')[0].trim().split(', ').map(form=> comb(form))
                let forms = formstr.split('()')[0].trim().split(',').map(form=> comb(form.trim()))
                let res =  {time: mark, rdict, dict, pdict, type, aug, formstr, forms, verbs: store, parts, infs, trns} //  // TRNS, STORE
                let cres = _.clone(res)
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
            pdict = plain(dict)
            type = 'VERB-TYPE' // makeVerbType(dict)
            // aug = parseAug(dict)
            if (!type) log('_rdict_no_type', rdict, dict)
            if (!type) throw new Error('_NO TYPE')
            trns = []
        } else if (/= Present/.test(descr)) {
            if (!row.split(':')[1]) log('ROW NO PRESENT', row)
            formstr = row.split(':')[1].trim()
            mark = 'pres'
        } else if (/= Imperfect/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'impf'
        } else if (/= Aorist/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'aor'
        } else if (/= Future perfect/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'fpf'
        } else if (/= Future/.test(descr)) {
            formstr = row.split(':')[1].trim()
            mark = 'fut'
        } else if (/= Perfect/.test(descr)) {
            // if (!row.split(':')[1]) d('ROW 1', row)
            formstr = row.split(':')[1].trim()
            mark = 'pf'
        } else if (/= Pluperfect/.test(descr)) {
            // if (!row.split(':')[1]) d('ROW 2', row)
            formstr = row.split(':')[1].trim()
            mark = 'ppf'
        } else if (/inf/.test(descr)) {
            let str = row.split(':')[1]
            if (!str) return
            str = str.trim()
            let forms = str.split(', ')
            forms = forms.map(form=> { return comb(form) })
            let inf = {tense: descr, forms: forms}
            infs.push(inf)
            if (infs.length >3) {
                log('_INF ERR', row, rdict, mark)
                throw new Error()
            }
        } else if (/part/.test(descr)) {
            let str = row.split(':')[1]
            if (!str) return
            str = str.trim()
            let forms = str.split(', ')
            forms = _.filter(forms, form=> { return form.split(' ').length == 1 }) // PERFECT
            forms = forms.map(form=> { return comb(form) })
            if (!forms.length) return
            let tense = [voice, mark, 'part'].join('.')
            let gend = descr.split('-')[1]
            let part = {tense, gend, forms}
            // log('_P', part)
            parts.push(part)
            // } else  if (/mp.pf.sub\./.test(descr) || /mp.pf.opt\./.test(descr)) {
            // return
            // } else  if (/act\./.test(descr) || /mp\./.test(descr) || /mid\./.test(descr) || /pas\./.test(descr)) {
        } else  if (/^...\.ind/.test(descr) || /^sub/.test(descr) || /^opt/.test(descr) || /^imp/.test(descr)) {
            let mood = descr
            if (/ind/.test(descr)) {
                voice = descr.split('.')[0]
                descr = [voice, mark, 'ind'].join('.')
            } else descr = [voice, mark, descr].join('.')

            if ((voice == 'mid' || voice == 'pas') && mark == 'pf' && (mood == 'sub' || mood == 'opt')) return

            let str = row.split(':')[1]
            if (!str) return
            let forms = str.trim().split(', ')
            if (forms.length != 8) {
                log('_not_8', forms)
                throw new Error('_not_8')
            }
            forms = _.filter(forms, form=> { return form.split(' ').length == 1 }) // PERFECT
            if (!forms.length) return
            forms = forms.map(form=> { return comb(form) })
            let res = {tense: descr, forms: forms}
            store.push(res)
        } else if (row[0] == ' ') {
            if (trns) trns.push(trn)
        }
    })
    return pars
}


function parseText_ (rows, only) {
    let pars = []
    let rdict, dict, pres, futs, trns, trn, voice
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
                let res =  {time: mark, rdict, dict, formstr, data: store, parts, infs} // , trns: trns // TRNS, STORE
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
        // } else  if (/act\./.test(descr) || /mp\./.test(descr) || /mid\./.test(descr) || /pas\./.test(descr)) {
        } else  if (/^...\.ind/.test(descr) || /^sub/.test(descr) || /^opt/.test(descr) || /^imp/.test(descr)) {
            let mood = descr
            if (/ind/.test(descr)) {
                voice = descr.split('.')[0]
                descr = [voice, mark, 'ind'].join('.')
            } else descr = [voice, mark, descr].join('.')

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
