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

// 1. вопросы: εἰσαγγέλλω
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
// συγκαθαιρέω
// ἀντιπαραγράφω, προσαπαγγέλλω, ἐπεξήγησις
// πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
// εὐχαριστία,
// προσαναμιμνήσκω, προσδιαιρέω
// παραγγέλλω = vow
// ἀμφίβραχυς - adj
// προσδιαγράφω, προσ-δια-φορέω, προσ-επ-εισ-φορέω

// теперь: prefs-no-prefs / conn-no-conn / tail-no-tail / conn-no-conn -> flex

// head - αἱρέω
// head - tail
// head - conn - tail

// prefs - head
// prefs - head - tail
// prefs - head - conn - tail
// prefs - conn - head
// prefs - conn - head - tail
// prefs - conn - head - conn - tail

// и - разные требования к компаундам - если есть tail, то simple

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
    dag.aug = parseAug(dag.pcwf)
    if (dag.aug) {
        dag.pcwf = dag.pcwf.replace(dag.aug, '')
    }

    dag.prefs = await findPrefs(dag, dag.pcwf)
    log('_dag.prefs', dag.prefs)
    // ZERO
    dag.prefs.push({seg: '', cdicts: [], nopref: true})

    let chains = []
    // todo: а если pref = a-привативум найден, а на самом деле просто aug?
    for await (let pref of dag.prefs) {
        let re = new RegExp('^' + pref.seg)
        let pcwf = dag.pcwf.replace(re, '')
        log('\n_PREF_', dag.pcwf, ':', pref.seg, '-', pcwf)
        let augconn = {}
        if (!pref.zero) {
            augconn = findConnection(pcwf)
            if (augconn.conn) {
                let re = new RegExp('^' + augconn.conn)
                pcwf = pcwf.replace(re, '')
            }
        }

        let breaks = makeBreaks(pcwf, dag.flexes)
        log('_pcwf', pcwf)
        log('_breaks', breaks.length)

        // todo: del - только инфо:
        let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-'))
        /* log('_breaksids-XXX', breaksids) */
        /* if (augconn.conn) breaksids.unshift(augconn.conn) */
        /* if (dag.aug) breaksids.unshift(dag.aug) */
        /* breaksids = breaksids.join('-') */
        log('_breaks-ids', breaksids)

        // HERE // note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза. Не страшно, но вызовет вопросы

        let prefchains = await combineChains(breaks, pref, augconn)
        /* prefchains.forEach(chain=> chain.unshift(pref)) */
        /* log('_prefchains', prefchains) */
        chains.push(...prefchains)
    }
    return chains
}

async function combineChains(breaks, pref, augconn) {
    /* let ddicts = await findDdicts(breaks) */
    let dicts = await findDdicts(breaks)
    /* let ddictids = ddicts.map(ddict=> ddict._id) */
    let dictstems = _.uniq(dicts.map(dict=> dict.stem))
    log('_dictstems_uniq:', dictstems)

    let chains = []
    for await (let br of breaks) {
        /* log('_BREAK', br.head, 'conn:', br.conn,  'tail:', br.tail) */
        /* let dicthead = ddicts.find(ddict=> ddict._id == br.head) */
        /* let dicthead = dicts.find(dict=> dict.stem == br.head) */
        /* if (!dicthead) continue */
        /* let headdicts = dicthead.docs */
        /* log('_headdicts.docs', br.head, headdicts.length) */
        /* if (!headdicts.length) continue */

        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        if (!headdicts.length) continue


        let chain = []
        let dictfls = []
        if (pref.nopref) {
            if (br.tail) {
                // todo: вообще убрать _id, оставить только docs
                /* let dtail = ddicts.find(ddict=> ddict._id == br.tail) */
                /* let dtail = dicts.find(dict=> dict.stem == br.tail) */
                /* if (!dtail) continue */
                /* let taildicts = dtail.docs */
                let taildicts = dicts.filter(dict=> dict.stem == br.tail)
                if (!taildicts.length) continue

                if (br.conn) { //  πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
                    /* log('_HEADDICTS', headdicts) */
                    log('_CMB_NO_PREF_CONN_TAIL', br.head, br.conn, br.tail) // todo: м.б. случай, когда соед. гласная, а затем aug
                    taildicts = taildicts.filter(dict=> aug2vow(br.conn, dict.aug))
                    /* log('_TAILDICTS', taildicts) */
                    dictfls = await dict2flexFilter(taildicts, br.fls.docs)
                    if (!dictfls.length) continue
                    chain = [{seg: br.head, dicts: headdicts}, {seg: br.conn}, {seg: br.tail, cdicts: dictfls}, {seg: br.fls._id, flex: true}]
                } else { // compound без коннектора
                    taildicts = taildicts.filter(dict=> !dict.aug)
                    log('_CMB_NO_PREF_NO_CONN_TAIL')
                }

            } else {
                log('_CMB_SIMPLE')
                dictfls = await dict2flexFilter(headdicts, br.fls.docs)
                if (!dictfls.length) continue
                chain = [{seg: dag.aug, aug: true}, {seg: br.head, cdicts: dictfls}, {seg: br.fls._id, flex: true}]
                /* log('_SIMPLE CHAIN', chain) */
            }

        } else { // PREFS
            if (br.tail) {
                if (br.conn) {
                    log('_CMB_PREF_TAIL_CONN')
                } else {
                    log('_CMB_PREF_TAIL')
                }
            } else {
                /* log('_AUGCONN', augconn) */
                /* log('_PREF', pref) */
                // προσδι-α-γράφω
                // здесь -x- м.б. аугментом, а м.б. конектором
                // и случай - коннектор, а затем еще аугмент
                log('_CMB_PREF_NO_TAIL_SIMPLE', br.head)
                if (augconn) headdicts = headdicts.filter(dict=> aug2vow(augconn.conn, dict.aug))
                dictfls = await dict2flexFilter(headdicts, br.fls.docs)
                if (!dictfls.length) continue
                chain = [{seg: pref.seg, pref: true}, {seg: augconn.conn, augconn: true}, {seg: br.head, cdicts: dictfls}, {seg: br.fls._id, flex: true}]
                log('_AUGCHAIN', chain)
            }
        }
        if (dictfls.length) chains.push(chain)
    }
    return chains
}

// это для компаунда, стресс не совпадает
async function dict2flexFilter(dicts, fls) {
    let cdicts = []
    for (let cdict of dicts) {
        let dict = _.clone(cdict)
        log('____________________dict', dict.stem, dict.rdict, dict.dname)
        dict.fls = []
        for await (let flex of fls) {
            /* log('_flex:', flex) */
            let ok = false
            /* if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true */
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true
            else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
            else if (dict.part && flex.part ) ok = true
            else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
            /* else if (compound && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
            if (ok) dict.fls.push(flex)
        }
        /* if (dict.fls.length) log('____________________dict', dict.stem, dict.rdict) */
        if (dict.fls.length) cdicts.push(dict)
    }
    return cdicts
}

// ================================================= FILTERS ==============
function dict2flex_(dicts, fls, simple) {
    let cdicts = []
    for (let cdict of dicts) {
        let dict = _.clone(cdict)
        log('____________________dict', dict.stem, dict.rdict, dict)
        dict.fls = []
        for (let flex of fls) {
            /* log('_flex:', flex) */
            let ok = false
            if (simple) {
                if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend)) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
            } else {
                if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true
                else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
                else if (dict.part && flex.part ) ok = true
                else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
                /* else if (compound && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
            }

            if (ok) dict.fls.push(flex)
        }
        /* if (dict.fls.length) log('____________________dict', dict.stem, dict.rdict) */
        if (dict.fls.length) cdicts.push(dict)
    }
    return cdicts
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
        let phead = pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, connection, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head || vowels.includes(_.last(head))) continue
            tail = phead.slice(pos)
            connection = findConnection(tail)
            if (connection) {
                res = {head, conn: connection.conn, tail: connection.tail, fls}
            } else {
                res = {head, tail, fls}
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
    /* log('_prefs', prefs) */
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
