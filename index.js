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

    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?
    let aug = parseAug(dag.pcwf)
    let zero = {seg: aug, cdicts: []}
    dag.prefs.push(zero)

    if (!dag.prefs.length) {
        // let aug = parseAug(dag.pcwf)
        // if (aug) dag.pcwf = dag.pcwf.replace(aug, '')
        // здесь м.б. aug + pref !
        // let zero = {seg: aug, cdicts: []}
        // dag.prefs.push(zero)
    }

    let chains = []
    for (let pref of dag.prefs) {
        let {conn, pcwf} = schemePref(pref, dag.pcwf)
        p('_scheme pref_ seg:', pref.seg, 'conn:', conn, 'pcwf', pcwf)
        // pref.seg = pref.seg + conn // д.б. равно aug
        pref.conn = conn

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
            let headdicts = dicts.filter(dict=> dict.stem == brk.head)
            let taildicts = dicts.filter(dict=> dict.stem == brk.tail)
            let pdicts = (brk.tail) ? taildicts : headdicts
            let mainseg = (brk.tail) ? (brk.tail) : (brk.head)

            // conn: здесь д.б. сложная довольно функция определения соответствия conn и наличия aug во flex-е.
            // pref: περισπάω, καθαίρω, παραγράφω, παραβάλλω
            // χρονοκρατέω, ἀδικέω
            // все случаи:
            // aug - ἀδικέω
            // aug+pref
            // pref - head - conn - tail
            // aug - head - conn - tail

            let aucon = (brk.tail) ? brk.conn : pref.conn ? pref.conn : pref.seg
            if (aucon == 'ο') aucon = ''
            log('_AUCON pref.seg:', pref.seg, '_aucon:', aucon)
            // !dict.augs - names, etc
            // dict.augs.includes(aucon) - ἀδικέω - odd δικάζω

            pdicts.forEach(pdict=> {
                // log('_D', pdict.rdict, pdict.augs)
            })

            pdicts = pdicts.filter(dict=> !aucon || !dict.augs || strip(dict.aug) == strip(aucon))
            // pdicts = pdicts.filter(dict=> !aucon || !dict.augs || dict.augs.includes(aucon))

            // сравниваю по первой букве connector и flex.aug
            let pfls = brk.fls.docs
            if (aucon && aucon !=pref.seg) pfls = pfls.filter(flex=> aug2vow(aucon, flex.aug))

            let {cdicts, cfls} = dict2flexFilter(aucon, pdicts, pfls)
            g('\n_CLEANBR aucon:', aucon, 'head:', brk.head, 'conn:', brk.conn, 'tail:', brk.tail, 'fls:', brk.fls._id)

            if (cdicts.length) {
                g('_aucon', aucon)
                g('_pdicts:', pdicts.length, '_pfls:', pfls.length)
                g('_after_filter: cdicts:', cdicts.length, 'cfls:', cfls.length)
                let flsseg = {seg: brk.fls._id, fls: cfls}
                let chain = [flsseg]
                if (taildicts.length) {
                    let tailseg = {seg: mainseg, cdicts}
                    chain.unshift(tailseg)
                }
                let connseg = {seg: brk.conn, conn: true}
                if (brk.conn) chain.unshift(connseg)
                if (headdicts.length) {
                    let headseg = {seg: brk.head, cdicts: headdicts}
                    chain.unshift(headseg)
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
