const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

/* import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, stressPosition } from './lib/utils.js' */
import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, getStress } from './lib/utils.js'
import { getTerms, getFlexes, getDdicts, getPrefs } from './lib/remote.js'
import Debug from 'debug'

const d = Debug('app')
const g = Debug('dag')
const p = Debug('prefs')

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

// αἱρέω
// συγκαθαιρέω, καθαιρέω
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
    dag.stress = getStress(dag.cwf)
    let flakes = scrape(dag.cwf).reverse()
    /* d('_flakes', flakes) */
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
    // теперь связка может быть сложной, vows+pref+vows
    // то есть в breaks я не знаю, где dict, а где pref
    // анализ br-line начинать с конца - выбор dicts в зависимости от bundle - если vow+pref+vow, то сл. dict пропустить, это pref

    // в словаре pref отдельно. То есть искать длинный стем pref+stem не имеет смысла
    // если stem не найден, то и pref+stem не будет найден

    // д.б. четкие правила вычисления aug, и общий модуль.
    //  περισπάω - augs: [ 'περι', 'περιε' ]

    dag.prefs = await findPrefs(dag, dag.pcwf)
    log('_dag.prefs', dag.prefs)

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
        log('_SOURCE_', pref.seg, conn, pcwf)
        pref.seg = pref.seg + conn // д.б. равно flex.aug

        let breaks = makeBreaks(pcwf, dag.flexes)
        log('_breaks', breaks.length)
        let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
        // log('_breaks-ids', breaksids)

        // dicts - те, что есть в словарях
        let dicts = await findDdicts(breaks)
        /* let ddictids = ddicts.map(ddict=> ddict._id) */
        let dictstems = _.uniq(dicts.map(dict=> dict.stem))
        log('_dictstems_uniq_:', dictstems)

        // только те, которые состоят из обнаруженных в словарях stems
        // clean breaks
        breaks = breaks.filter(brk=> {
            let ok = true
            if (brk.head && !dictstems.includes(brk.head)) ok = false
            if (brk.tail && !dictstems.includes(brk.tail)) ok = false
            return ok
        })

        log('_breaks_clean', breaks.length)
        log('_breaks-IDs_', prettyBeakIDs(breaks))

        // clean dicts:
        let heads = _.uniq(breaks.map(br=> br.head))
        let tails = _.uniq(breaks.map(br=> br.tail))
        let cstems = _.compact(heads.concat(tails))
        dicts = dicts.filter(dict=> {
            return cstems.includes(dict.stem)
        })
        log('_clean dicts', dicts.length)
        for (let dict of dicts) {
            // log('_clean dict', dict)
        }
        let cleandictstems = _.uniq(dicts.map(dict=> dict.stem))
        log('_cleandictstems_:', cleandictstems)

        // = FILTERS =
        for (let brk of breaks) {
            if (!brk.conn) brk.conn = ''
            log('\n_CLEANBR head:', brk.head, 'conn:', brk.conn, 'tail:', brk.tail, brk.fls._id)
            let headdicts = dicts.filter(dict=> dict.stem == brk.head)
            let taildicts = dicts.filter(dict=> dict.stem == brk.tail)
            let pdicts = (brk.tail) ? taildicts : headdicts

            // здесь д.б. сложная довольно функция определения соответствия conn и наличия aug во flex-е.
            // let conn = 'ο'
            // if (conn == 'ο') conn = ''
            let aucon = (brk.tail) ? brk.conn : pref.seg

            pdicts = pdicts.filter(dict=> !dict.augs || dict.augs.includes(aucon))
            let pfls = brk.fls.docs.filter(flex=> flex.aug == aucon)


            let {cdicts, cfls} = dict2flexFilter(aucon, pdicts, pfls)
            // let {cdicts, cfls} = dict2flexFilter(aucon, taildicts, brk.fls.docs)
            log('_TAIL C-DICTS', cdicts.length)
            let idx = 0
            for (let cdict of cdicts) {
                log('_cdict', cdict.rdict)
                let fls = cfls[idx]
                let prettys = prettyFLS(fls)
                log('_c-fls', prettys)
                idx++
            }
        }
    }

    let chains = []
    return chains
}

// filters. В lsjs нет keys. Грубо: сначала wkts, затем выбрать аналоги и lsjs, затем filter lsjs без keys. Очень сложно и некрасиво
// names: type, wkts-lsjs-key, gend, aug?
// verbs: type, wkts-tense, aug
// verb.dict.augs - в словаре нет полной формы стема, а истинный стем
//

// ================================================= FILTERS ==============

// BUG περισπάω - περιέσπαντο - aug высчитывается неверно, пропадает ударение

function dict2flexFilter(aug, dicts, fls) {
    // log('_________filter-aug_________', aug)
    let cdicts = []
    let cfls = []
    // fls = fls.filter(flex=> !!flex.aug == !!aug)
    // fls = fls.filter(flex=> flex.aug == aug)
    // fls = fls.filter(flex=> !flex.aug)
    for (let dict of dicts) {
        // if (!dict.keys) log('_dict-no-keys',dict)
        if (!dict.rdict) continue // TODO WTF?
        log('_____dict____:', dict.rdict)
        let dfls = []
        for(let flex of fls) {
            log('_____flex____:', flex.numper, flex.tense, flex.term, flex.aug)
            let ok = false
            /* if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true */
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true
            else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
            else if (dict.part && flex.part ) ok = true
            // else if (dict.verb && flex.verb) ok = true
            else if (dict.verb && flex.verb && dict.keys.find(tense=> tense == flex.tense)) ok = true
            // else if (dict.verb && flex.verb && dict.keys.find(tense=> tense == flex.tense) && dict.augs.includes(aug)) ok = true
            // else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
            /* else if (compound && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
            // if (ok) dict.fls.push(flex)
            if (ok) dfls.push(flex)
        }
        if (dfls.length) log('____dict.fls', dict.stem, dict.rdict)
        if (dfls.length) {
            cdicts.push(dict)
            // log('__filter.dict', dict)
            cfls.push(dfls) // each dict has array of fls
        }
    }
    // log('_________filter_________: cfls', cfls.length)
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
    // log('_pref:', dag.pcwf, ':', pref.seg, conn, tail)
    if (conn) {
        let reconn = new RegExp('^' + conn)
        pcwf = pcwf.replace(reconn, '')
    }
    // log('_pcwf', pcwf)
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

async function findDdicts(breaks) {
    let headkeys = _.uniq(breaks.map(br=> br.head))
    /* log('_headkeys', headkeys) */
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    /* log('_tailkeys', tailkeys) */
    let keys = _.compact(headkeys.concat(tailkeys))
    /* log('_keys', keys.length) */
    /* let ddicts = await getDdicts(keys) */
    let dicts = await getDdicts(keys)
    /* log('_ddicts', ddicts) */
    /* log('_ddicts', ddicts[0].docs) */
    /* dag.ddictids = ddicts.map(ddict=> ddict._id) */
    dag.dictids = dicts.map(ddict=> ddict.stem)
    /* p('_ddictids', dag.ddictids) */
    return dicts
}

export async function findPrefs(dag, pcwf) {
    p('___find_pref:', pcwf)
    let headkeys = dag.flakes.map(flake=> plain(flake.head))
    p('_headkeys', headkeys)
    let prefs = await getPrefs(headkeys)
    p('_find_prefs', prefs)
    // compound - προσδιαιρέω
    // выбрать compound-prefs, если есть - найти длиннейший
    // и забрать исходники
    let cprefs = prefs.filter(pref=> pref.cpref)
    if (cprefs.length) {
        let compound = _.maxBy(cprefs, function(pref) { return pref.term.length; })
        /* log('_MAX', compound) */
        prefs = await getPrefs(compound.prefs)
        prefs.unshift(compound)
        prefs = prefs.filter(pref=> pref.term[0] == pcwf[0])
    }
    /* log('_PREFS', prefs) */

    prefs.forEach(pref=> pref.plain = plain(pref.term))
    prefs = prefs.map(pref=> {return {seg: pref.plain, cdicts: [pref], pref: true}})
    return prefs
}
