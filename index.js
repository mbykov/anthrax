const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

/* import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, stressPosition } from './lib/utils.js' */
import { accents, scrape, vowels, stresses, parseAug, vnTerms, aug2vow, getStress } from './lib/utils.js'
import { getTerms, getFlexes, getSegments, getPrefs } from './lib/remote.js'
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
//

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
        log('_breaks', breaks.length)

        // todo: del - только инфо:
        let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-'))
        /* log('_breaksids-XXX', breaksids) */
        if (augconn.conn) breaksids.unshift(augconn.conn)
        if (dag.aug) breaksids.unshift(dag.aug)
        /* breaksids = breaksids.join('-') */
        log('_breaks-ids', breaksids)

        // HERE // note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза. Не страшно, но вызовет вопросы

        let prefchains = await combineChains(breaks, pref.nopref)
        /* prefchains.forEach(chain=> chain.unshift(pref)) */
        /* log('_prefchains', prefchains) */
        chains.push(...prefchains)
    }
    return chains
}

async function combineChains(breaks, nopref) {
    let ddicts = await findDdicts(breaks)
    let ddictids = ddicts.map(ddict=> ddict._id)
    log('_ddictids:', ddictids)

    let chains = []
    for await (let br of breaks) {
        /* log('_BREAK', br.head, 'conn:', br.conn,  'tail:', br.tail) */
        let dicthead = ddicts.find(ddict=> ddict._id == br.head)
        if (!dicthead) continue
        if (dicthead._id == 'καθαιρ') log('_CHAIN HEAD', dicthead._id)
        let headdicts = dicthead.docs
        /* log('_headdicts.docs', br.head, 'tail:', br.tail, 'docs:', headdicts.length) */
        if (!headdicts.length) continue
        headdicts = headdicts.filter(dict=> dict.aug == dag.aug)

        let chain = []
        let dictfls = []
        if (nopref) {
            if (br.tail) {
                let dtail = ddicts.find(ddict=> ddict._id == br.tail)
                if (!dtail) continue
                let taildicts = dtail.docs

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

                }

            } else {
                log('_CMB_SIMPLE')
            }

        } else { // PREFS
            if (br.tail) {
                if (br.conn) { pref+comp+conn - προσδιαιρέω, προσ-δια-γράφω
                    log('_CMB_PREF_TAIL_CONN')
                } else {
                    log('_CMB_PREF_TAIL')

                }
            } else {
                log('_CMB_PREF_NO_TAIL_SIMPLE')
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
        /* log('____________________dict', dict.stem, dict.rdict) */
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
function dict2flex(dicts, fls, simple) {
    let cdicts = []
    for (let cdict of dicts) {
        let dict = _.clone(cdict)
        /* log('____________________dict', dict.stem, dict.rdict) */
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
    let ddicts = await getSegments(keys)
    /* log('_ddicts', ddicts) */
    /* log('_ddicts', ddicts[0].docs) */
    dag.ddictids = ddicts.map(ddict=> ddict._id)
    /* p('_ddictids', dag.ddictids) */
    return ddicts
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

// ===================================== REMOVE ===================

function makeBreaks_wo_conn(pcwf, flexes) {
    let breaks = []
    for (let fls of flexes) {
        let pterm = plain(fls._id)
        let phead = pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, conn, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head || vowels.includes(_.last(head))) continue
            tail = phead.slice(pos)
            res = {head, tail, fls}
            if (tail && head.length < 3) continue // в компаундах FC не короткие, но в simple короткие м.б.
            breaks.push(res)
        }
    }
    return breaks
}

async function combineChains_old_copy(breaks) {
    let ddicts = await findDdicts(breaks)
    let ddictids = ddicts.map(ddict=> ddict._id)
    /* log('_ddictids_', ddictids) */
    /* log('_breaks', breaks) */

    let chains = []
    for (let br of breaks) {
        let dhead = ddicts.find(ddict=> ddict._id == br.head)
        if (!dhead) continue
        let heads = dhead.docs
        /* log('_heads', br.head, br.tail, heads.length) */

        if (!heads.length) continue
        if (dag.prefs) {
            let connect = dag.prefs[dag.prefs.length-1]
            if (connect && connect.vowel) heads = heads.filter(dict=> aug2vow(connect.plain, dict.aug))
        }

        /* log('_dag.aug', br.head, dag.aug) */
        /* log('___heads_2', br.head, br.tail, heads.length) */

        let chain = []
        let dictfls = []
        if (br.tail) {
            let dtail = ddicts.find(ddict=> ddict._id == br.tail)
            if (!dtail) continue
            let tails = dtail.docs
            chain.push({plain: br.head, cdicts: heads})
            if (br.vow) {
                chain.push({plain: br.vow, vowel: true})
                tails = tails.filter(dict=> aug2vow(br.vow, dict.aug))
            } else {
                tails = tails.filter(dict=> !dict.aug)
            }
            // компаунды временно отрубил для simple тестов
            /* dictfls = dict2flex(tails, br.fls.docs, true) */
            if (!dictfls.length) continue
            /* log('________________tail+fls', br.head, br.tail, br.fls._id, 'fls', dictfls.length) */
            chain.push({plain: br.tail, cdicts: dictfls, flex:br.fls._id, cmp: true})
        } else {
            log('_no_tail_', br.head, heads.length, br.fls.docs.length)
            dictfls = dict2flex(heads, br.fls.docs, dag)
            if (!dictfls.length) continue
            /* log('___SIMPLE:', br.head, 'heads.length', heads.length, 'tail', br.tail, br.fls._id, 'fls', br.fls.docs.length, dictfls.length) */
            chain.push({plain: br.head, cdicts: dictfls, flex: br.fls._id})
        }
        if (dictfls.length) chains.push(chain)
    }
    return chains
}

function tmp() {
    if (dag.prefs.length) {
        let lastpref = _.last(dag.prefs)
        if (lastpref.vowel) dag.aug = lastpref.plain
        let prefstr = dag.prefs.map(pref=> pref.plain).join('')
        log('_prefstr', prefstr)
        dag.pcwf = dag.pcwf.replace(prefstr, '') || ''
        log('_dag.pcwf', dag.pcwf)
        // найти vow или connect

    } else {
        dag.aug = parseAug(dag.pcwf)
        if (dag.aug) dag.pcwf = dag.pcwf.slice(dag.aug.length)
    }

    // breaks - [head, tail, fls]
    log('_DAG.PCWF', dag.pcwf)
    let breaks = makeBreaks(dag)
    log('_breaks', breaks.length)
    let breaksids = breaks.map(br=> [dag.aug, br.head, br.conn, br.tail, br.fls._id].join('-'))
    log('_breaks-ids', breaksids)

    /* let chains = await combineChains(breaks) */
    /* log('_chains', chains) */

    /* if (dag.prefs.length) chains = chains.map(chain=> dag.prefs.concat(chain)) */
    /* return chains */


    /* continue */

    /* if (br.tail) { */
    /* let dtail = ddicts.find(ddict=> ddict._id == br.tail) */
    /* if (!dtail) continue */
    /* let tails = dtail.docs */
    /* chain.push({plain: br.head, cdicts: heads}) */
    /* if (br.vow) { */
    /* chain.push({plain: br.vow, vowel: true}) */
    /* tails = tails.filter(dict=> aug2vow(br.vow, dict.aug)) */
    /* } else { */
    /* tails = tails.filter(dict=> !dict.aug) */
    /* } */
    /* log('___COMPOUND:', br.head, 'heads.length', heads.length, 'tail', br.tail, br.fls._id) */
    /* dictfls = dict2flex(tails, br.fls.docs, true) */
    /* if (!dictfls.length) continue */
    /* log('________________tail+fls', br.head, br.tail, br.fls._id, 'fls', dictfls.length) */
    /* chain.push({plain: br.tail, cdicts: dictfls, flex:br.fls._id, cmp: true}) */
    /* } else { */
    /* log('_chain_no_tail_', br.head, heads.length, br.fls._id) */
    /* dictfls = dict2flex(heads, br.fls.docs) */
    /* if (!dictfls.length) continue */
    /* log('___SIMPLE:', br.head, 'heads.length', heads.length, 'tail', br.tail, br.fls._id, 'fls', br.fls.docs.length, dictfls.length) */
    /* chain.push({plain: br.head, cdicts: dictfls, flex: br.fls._id}) */
    /* } */
    /* if (dictfls.length) chains.push(chain) */


}
