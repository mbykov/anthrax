const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

/* import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, stressPosition } from './lib/utils.js' */
import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, getStress } from './lib/utils.js'
import { getTerms, getFlexes, getDdicts, getPrefs } from './lib/remote.js'
import Debug from 'debug'

const d = Debug('dag')
const p = Debug('pref')
const g = Debug('filter')

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
    dag.chains = []
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

    // == TODO ==
    // аккуратно найти prefs / aug
    // в prefs-цикле найти breaks
    // найти значимые dicts, i.e. head-tail, кроме conn и flex
    // полные breaks - > chails
    // связки - bundles - анализ
    // aug во flex - глупо, перенести в dict
    // теперь связка может быть сложной, aug+pref+vows, но ἀδικέω

    // в словаре pref отдельно. То есть искать длинный стем pref+stem не имеет смысла
    // если stem не найден, то и pref+stem не будет найден

    // д.б. четкие правила вычисления aug, и общий модуль.
    //  περισπάω - augs: [ 'περι', 'περιε' ]

    dag.prefs = await findPrefs(dag)
    p('_dag.prefs', dag.prefs)

    // remove pref or aug
    // breaks to chains
    if (!dag.prefs.length) {
        let aug = parseAug(dag.pcwf)
        if (aug) dag.pcwf = dag.pcwf.replace(aug, '')
        // здесь м.б. aug + pref !
        let zero = {seg: aug, cdicts: []}
        dag.prefs.push(zero)
    }

    for (let pref of dag.prefs) {
        let {conn, pcwf} = schemePref(pref, dag.pcwf)
        p('_scheme pref_ seg:', pref.seg, 'conn:', conn, 'pcwf', pcwf)
        pref.seg = pref.seg + conn // д.б. равно flex.aug

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

        // = FILTERS =
        for (let brk of breaks) {
            if (!brk.conn) brk.conn = ''
            g('\n_CLEANBR pref:', pref.seg, 'head:', brk.head, 'conn:', brk.conn, 'tail:', brk.tail, brk.fls._id)
            let headdicts = dicts.filter(dict=> dict.stem == brk.head)
            let taildicts = dicts.filter(dict=> dict.stem == brk.tail)
            let pdicts = (brk.tail) ? taildicts : headdicts

            // здесь д.б. сложная довольно функция определения соответствия conn и наличия aug во flex-е.
            let aucon = (brk.tail) ? brk.conn : pref.seg
            if (aucon == 'ο') aucon = ''
            g('_aucon', aucon)

            // pdicts = pdicts.filter(dict=> !aucon || !dict.augs || dict.augs.includes(aucon))
            let pfls = brk.fls.docs // .filter(flex=> flex.aug == aucon)
            g('_pdicts', pdicts.length)
            g('_pfls', pfls.length)

            let {cdicts, cfls} = dict2flexFilter(aucon, pdicts, pfls)

            g('_after_filter_ cdicts:', cdicts.length, 'cfls:', cfls.length)

            if (cdicts.length) {
                const chain = []
                let idx = 0
                for (let cdict of cdicts) {
                    g('_cdict', cdict.rdict)
                    let fls = cfls[idx]
                    let prettys = prettyFLS(fls)
                    g('_c-fls', prettys)
                    idx++
                }
            }

        }
    } // pref

    let chains = []
    return chains
}

// filters. В lsjs нет keys. Грубо: сначала wkts, затем выбрать аналоги и lsjs, затем filter lsjs без keys. Очень сложно и некрасиво
// names: wkts-lsjs-key, gend, aug?
// verbs: wkts-tense, aug
// verb.dict.augs - в словаре нет полной формы стема, а истинный стем

// ================================================= FILTERS ==============

// BUG περισπάω - περιέσπαντο - aug высчитывается неверно, пропадает ударение

function dict2flexFilter(aug, dicts, fls) {
    let cdicts = []
    let cfls = []
    for (let dict of dicts) {
        // log('_____dict____:', dict.verb, dict.rdict, dict.stem, dict.keys)
        let dfls = []
        for(let flex of fls) {
            if (!flex.verb) continue
            // log('_____flex____:', flex.numper, flex.tense, flex.term, flex.aug, flex.key)
            let ok = false
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true
            else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
            else if (dict.part && flex.part ) ok = true

            // else if (dict.verb && flex.verb) ok = true
            // else if (dict.verb && flex.verb && dict.keys.find(tense=> tense == flex.tense)) ok = true
            else if (dict.verb && flex.verb && dict.keys.includes(flex.key)) ok = true
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

function schemePref(pref, pcwf) {
    let re = new RegExp('^' + pref.seg)
    pcwf = pcwf.replace(re, '')
    let {conn, tail} = findConnection(pcwf)
    if (conn) {
        let reconn = new RegExp('^' + conn)
        pcwf = pcwf.replace(reconn, '')
    }
    return {conn, pcwf}
}

function findConnection(str) {
    let vow = str[0]
    let conn = ''
    while(vowels.includes(vow)) {
        str = str.slice(1)
        conn += vow
        vow = str[0]
    }
    return {conn, tail: str}
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
    log('_find_prefs=', prefs)
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
