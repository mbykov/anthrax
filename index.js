const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

/* import { accents, scrape, vowels, stresses, parseAug, vnTerms, stressPosition } from './lib/utils.js' */
import { scrape, vowels, parseAug, aug2vow } from './lib/utils.js'
import { getTerms, getFlexes, getDdicts, getPrefs } from './lib/remote.js'
import Debug from 'debug'

const d = Debug('dag')
const p = Debug('pref')
const b = Debug('break')

// 1. вопросы: εἰσαγγέλλω // // // // // // // //
let dag = {}

export async function anthrax(wf) {
    let chains = []
    let cwf = comb(wf).toLowerCase()
    let termcdicts = await getTerms(cwf)
    let tchains =  [[{cdicts: termcdicts}]]
    if (termcdicts.length) chains.push(...tchains)

    let dchains = await anthraxChains(wf)
    if (dchains) chains.push(...dchains)
    return chains
}

// ἀδικέω - здесь δι не префикс
// αἱρέω,
// συγκαθαιρέω, καθαιρέω - нет в словаре, есть καθαίρω
// ἀντιπαραγράφω, προσαπαγγέλλω, ἐπεξήγησις
// πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
// εὐχαριστία,
// προσαναμιμνήσκω, προσδιαιρέω
// παραγγέλλω = vow
// ἀμφίβραχυς - adj
// προσδιαγράφω, προσδιαφορέω, προσεπεισφορέω
// note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза.


async function anthraxChains(wf) {
    dag = new Map();
    // dag.chains = []
    dag.cwf = comb(wf)
    // dag.stress = getStress(dag.cwf)
    let flakes = scrape(dag.cwf).reverse()

    if (!flakes.length) return
    dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)

    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    dag.tail = dag.pcwf
    d('_pcwf', dag.pcwf)

    // теперь связка может быть сложной, aug+pref+vows, но ἀδικέω
    // в словаре pref отдельно. То есть искать длинный стем pref+stem не имеет смысла
    // если stem не найден, то и pref+stem не будет найден

    dag.prefs = await findPrefs(dag)
    p('_dag.prefs', dag.prefs)

    // ἀδικέω - odd δικάζω
    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?
    let aug = parseAug(dag.pcwf)
    let zero = {seg: aug, cdicts: [], default: true} // whole wordform
    // if (aug) zero.aug = true
    // dag.prefs.push(zero)

    // сделать prefs отдельно ?

    let chains = []
    for (let pref of dag.prefs) {
        let re = new RegExp('^' + pref.seg)
        let pcwf = dag.pcwf.replace(re, '')
        pref.conn = findConnection(pcwf)
        re = new RegExp('^' + pref.conn)
        pcwf = pcwf.replace(re, '')

        // let {conn, pcwf} = schemePref(pref, dag.pcwf)
        p('_\n==scheme pref== seg:', dag.pcwf, pref.seg, 'conn:', pref.conn, 'pcwf', pcwf)

        let {breaks, dicts} = await cleanBreacks(pcwf, dag)

        for (let brk of breaks) {
            if (!brk.conn) brk.conn = ''
            let headdicts = dicts.filter(dict=> dict.stem == brk.head)
            let taildicts = dicts.filter(dict=> dict.stem == brk.tail)
            let pdicts = (brk.tail) ? taildicts : headdicts
            let mainseg = (brk.tail) ? (brk.tail) : (brk.head)
            let conn = (brk.tail) ? brk.conn : pref.conn ? pref.conn : '' // или pref.seg ?

            if (conn == 'ο') conn = ''
            b('\n_==BRK==', 'head:', brk.head, 'br.conn:', brk.conn, 'tail:', brk.tail, 'fls:', brk.fls._id, '_mainseg:', mainseg)
            b('_brk pref.seg:', pref.seg, '_conn:', conn)

            // == PRE FILTERS ==
            let pfls = brk.fls.docs
            pdicts = pdicts.filter(pdict=> {
                // p('_pdicts_filter', mainseg, pdict.rdict, pdict.aug, pdict.augs, conn, strip(pdict.aug) == strip(aucon), 444, pref.seg, pdict.pref)
                // return true
                if (!pdict.pref) return true // compound
                if (pdict.pref && pref.seg != pdict.aug) return false

                // два разных случая - pref.seg и dict без pref, pref как часть chain
                // и - pref.seg и dict с pref, тогда они должны совпадать
                // и если второй, то вероятен и первый - ἀποδείκνυμι и δείκνυμι - оба в словаре, ἀναδεικνυμι - нет

                // if (!pdict.augs) return true
                // if (!pdict.aug) return true
                if (pdict.aug && strip(pdict.aug) == strip(conn)) return true
            })
            // log('_PDICTS_2', pdicts.length)

            // сравниваю по первой букве connector и flex.aug
            // if (conn && conn !=pref.seg) pfls = pfls.filter(flex=> aug2vow(conn, flex.aug))

            let {cdicts, cfls} = dict2flexFilter(conn, pdicts, pfls)

            b('_pdicts:', pdicts.length, '_pfls:', pfls.length)
            b('_after_filter: cdicts:', cdicts.length, 'cfls:', cfls.length)

            if (!cdicts.length) continue

            let flsseg = {seg: brk.fls._id, fls: cfls}
            let chain = [flsseg]

            let tailseg = {seg: mainseg, cdicts, mainseg: true}
            chain.unshift(tailseg)

            if (brk.head && brk.tail) {
                let connseg = {seg: brk.conn, conn: true}
                if (brk.conn) chain.unshift(connseg)
                if (headdicts.length) {
                    let headseg = {seg: brk.head, cdicts: headdicts, head: true}
                    chain.unshift(headseg)
                }
            }
            if (pref.seg) {
                let seg = pref.seg
                if (pref.conn) seg = [seg, pref.conn].join('')
                let prefseg
                if (pref.cdicts.length) prefseg = {seg: seg, cdicts: pref.cdicts, pref: true}
                else prefseg = {seg: seg, aug: true}
                chain.unshift(prefseg)
            }
            chains.push(chain)
        }
    } // pref

    // если есть короткий chain, то отбросить те chains, где sc имеет стемы с длиной = 1
    // let shorts = chains.find(chain=> chain.length == 2)
    if (chains.length > 1) {
        chains = chains.filter(chain=> chain.slice(-2,-1)[0].seg.length > 1)
    }
    // let chains = []
    return chains
}


// ================================================= FILTERS ==============
function dict2flexFilter(aug, dicts, fls) {
    let cdicts = []
    let cfls = []
    for (let dict of dicts) {
        // if (!dict.verb) continue
        // log('_____dict____:', dict.verb, dict.rdict, dict.stem)
        let dfls = []
        for(let flex of fls) {
            if (!flex.verb) continue
            // log('_____flex____:', flex.numper, flex.tense, flex.term, flex.aug, flex.key)
            let ok = false
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true
            else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
            else if (dict.part && flex.part ) ok = true

            // else if (dict.verb && flex.verb) ok = true
            else if (dict.verb && flex.verb && dict.keys.includes(flex.key)) ok = true
            // else if (dict.verb && flex.verb && dict.keys.find(tense=> tense == flex.tense)) ok = true

            if (ok) dfls.push(flex)
            // if (ok) log('_____flex____:', flex.numper, flex.tense, flex.term, flex.aug, flex.key)
        }
        // if (dfls.length) log('____dict.fls', dict.stem, dict.rdict)
        if (dfls.length) {
            cdicts.push(dict)
            cfls.push(dfls) // each dict has array of fls
        }
    }
    return {cdicts, cfls}
}

async function cleanBreacks(pcwf, dag) {
    let breaks = makeBreaks(pcwf, dag.flexes)
    p('_breaks', breaks.length)
    let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
    // log('_breaks-ids', breaksids)

    // dicts - те, что есть в словарях
    let dicts = await findDicts(breaks)
    let dictstems = _.uniq(dicts.map(dict=> dict.stem))
    p('_dictstems_uniq_:', dictstems)

    // clean breaks - только те, которые состоят из обнаруженных в словарях stems
    breaks = breaks.filter(brk=> {
        let ok = true
        if (brk.head && !dictstems.includes(brk.head)) ok = false
        if (brk.tail && !dictstems.includes(brk.tail)) ok = false
        return ok
    })

    p('_breaks_clean', breaks.length)
    p('_breaks-IDs_', prettyBeakIDs(breaks))

    // clean dicts:
    let heads = _.uniq(breaks.map(br=> br.head))
    let tails = _.uniq(breaks.map(br=> br.tail))
    let cstems = _.compact(heads.concat(tails))
    dicts = dicts.filter(dict=> {
        return cstems.includes(dict.stem)
    })
    p('_clean dicts', dicts.length)
    let cleandictstems = _.uniq(dicts.map(dict=> dict.stem))
    p('_cleandictstems_:', cleandictstems)

    return {breaks, dicts}
}


function prettyBeakIDs(breaks) {
    return breaks.map(br=> {
        let strs = []
        if (br.head) strs.push(br.head)
        if (br.conn) strs.push(br.conn)
        if (br.tail) strs.push(br.tail)
        strs.push(br.fls._id)
        return strs.join('-')
    }) // todo: del
}

function prettyFLS(fls) {
    return fls.map(flex=> [flex.tense, flex.numper].join(', '))
}

// return словарное значение pref.term и коннектор до stem
function schemePref(pref, pcwf) {
    let re = new RegExp('^' + pref.seg)
    pcwf = pcwf.replace(re, '')
    let conn = findConnection(pcwf)
    if (conn) {
        let reconn = new RegExp('^' + conn)
        pcwf = pcwf.replace(reconn, '')
    }
    return {conn, pcwf}
}

function findConnection(pstr) {
    let vow = pstr[0]
    let conn = ''
    while(vowels.includes(vow)) {
        pstr = pstr.slice(1)
        conn += vow
        vow = pstr[0]
    }
    return conn
}

function makeBreaks(pcwf, flexes) {
    let breaks = []
    for (let fls of flexes) {
        let pterm = plain(fls._id)
        // if (pterm != 'εω') continue
        let phead = pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, connection, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head) continue
            // if (!head || vowels.includes(_.last(head))) continue // зачем я это добавил?
            // todo: наверное, на след шагу в conn чтобы сразу добавить гласную
            // но в простейшем ἀγαθοποιέω окончание έω, а head заканчивается на гласную, отбросить гласную здесь нельзя
            tail = phead.slice(pos)
            connection = findConnection(tail)
            // let {conn, tail} = findConnection(tail)
            if (connection.conn && connection.tail) {
                res = {head, conn: connection.conn, tail: connection.tail, fls}
                // log('_BR_c', head, connection.conn, connection.tail, fls._id)
            } else {
                // log('_BR', head, tail, fls._id)
                res = {head, conn: '', tail, fls}
            }
            /* if (!tail) continue */ // нельзя, если simple
            if (tail && head.length < 3) continue // в компаундах FC не короткие, но в simple короткие м.б.
            breaks.push(res)
        }
    }
    return breaks
}

async function findDicts(breaks) {
    let headkeys = _.uniq(breaks.map(br=> br.head))
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    let keys = _.compact(headkeys.concat(tailkeys))
    let dicts = await getDdicts(keys)
    dag.dictids = dicts.map(ddict=> ddict.stem)
    return dicts
}

export async function findPrefs(dag) {
    let headkeys = dag.flakes.map(flake=> plain(flake.head))
    // log('_headkeys', headkeys)
    let prefs = await getPrefs(headkeys)
    // log('_find_prefs=', prefs)
    // compound - προσδιαιρέω
    // выбрать compound-prefs, если есть - найти длиннейший
    // и забрать исходники
    let cprefs = prefs.filter(pref=> pref.cpref)
    if (cprefs.length) {
        let compound = _.maxBy(cprefs, function(pref) { return pref.term.length; })
        prefs = await getPrefs(compound.prefs)
        prefs.unshift(compound)
        prefs = prefs.filter(pref=> pref.term[0] == dag.pcwf[0])
    }
    /* log('_PREFS', prefs) */

    prefs.forEach(pref=> pref.plain = plain(pref.term))
    prefs = prefs.map(pref=> {return {seg: pref.plain, cdicts: [pref], pref: true}})
    return prefs
}
