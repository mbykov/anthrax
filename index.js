const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, aug2vow, aspirations } from './lib/utils.js'
import { getFlexes, getDicts } from './lib/remote.js' // getTerms, getTermsNew,  getPrefs
import Debug from 'debug'

import { vkeys } from '../anthrax-dicts/WKT/wkt/wkt-keys/keys-verb.js'
import { nkeys } from '../anthrax-dicts/WKT/wkt/wkt-keys/keys-name.js'
import { akeys } from '../anthrax-dicts/WKT/wkt/wkt-keys/keys-adj.js'
import { pKeys } from '../anthrax-dicts/WKT/wkt/wkt-keys/keys-part.js'

import { preflist } from '../prefslist/dst/preflist.js' //
import { prefdocs } from '../prefslist/dst/prefdocs.js' //

const d = Debug('app')
const p = Debug('pref')
const h = Debug('whole')
const f = Debug('filter')

let dag = {}

// let notdialectnames = ['name', 'verb', 'rdict', 'dict', 'type', 'stem', 'gends', 'trns', 'gens',  'dname']

// terms: πρίν
// ψευδο - убрать из префиксов!
// ἐπεξήγησις
// πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
// εὐχαριστία,
// προσαναμιμνήσκω, προσδιαιρέω
// παραγγέλλω = vow
// ἀμφίβραχυς - adj
// προσδιαγράφω, προσδιαφορέω, προσεπεισφορέω
// note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза.
// συγκαθαιρέω - а теперь бред
// προσεπεισφορέω
// εὐδαιμονία; εὐτυχία

let dbsdefault = ['wkt', 'bbl'] // , 'lsj' , 'dvr'

export async function anthrax(wf, dbs) {
    if (!dbs) dbs = dbsdefault
    // log('_WF', wf, '_DBS', dbs)

    let chains = []
    let cwf = oxia(comb(wf).toLowerCase())
    // let termcdicts = await getTerms(cwf)
    // log('_TD', termcdicts)

    // let termcdicts = await getTermsNew(cwf)
    let keys = [cwf]
    let termcdicts = await getDicts(keys, dbs)
    // log('_TERMS', termcdicts.length) // ***
    let wktterm = false
    if (termcdicts.length) {
        termcdicts = termcdicts.filter(doc=> keys.includes(doc.dict))
        wktterm = termcdicts.find(doc=> doc.dname == 'wkt')
        let rdicts = termcdicts.map(dict=> dict.rdict).join(',')
        let termchain =  [{seg: cwf, cdicts: termcdicts, rdicts, indecl: true}]
        log('_==============:', rdicts)
        chains.push(termchain)
    }
    if (wktterm) return chains

    let dictchains = await anthraxChains(cwf, dbs)
    // если есть короткий chain, то отбросить те chains, где sc имеет стемы с длиной = 1 // TODO = аккуратно сделать
    // let bestchain = chains.find(chain=> chain.slice(-2,-1)[0].seg.length > 1)        // ломается на ἀγαπητός
    // сначала длиннейшие
    dictchains = _.sortBy(dictchains, [function(chain) {
        let main = chain.find(seg=> seg.main)
        return -main.cdicts[0].rdict.length
    }]);
    // log('_CHAINS', dictchains.length) // ***
    chains.push(...dictchains)
    return chains
}

async function anthraxChains(wf, dbs) {
    dag = new Map();
    dag.rawwf = wf
    dag.cwf = comb(wf)
    let {stress, stressidx} = getStress(dag.cwf)
    dag.stress = stress
    dag.stressidx = stressidx

    // log('_DAG', dag)

    let flakes = scrape(dag.cwf).reverse()
    if (!flakes.length) return
    dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)
    // log('_flakes_tails', tails)

    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    d('_pcwf', dag.pcwf)

    // ἀδικέω - odd δικάζω; παραναβαίνω
    // проверить ἀνθράκινα, д.б. два результата
    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?

    let chains = []
    let breaks = []

    let preftails = await makePrefDocs(dag.cwf)
    let prefchains = await parsePrefChains(dag, preftails, dbs)
    chains.push(...prefchains)

    // log('_C', chains.length)

    if (chains.length) return chains
    // return chains

    // log('_============== BEFORE AUGS:', chains.length, dag.pcwf)

    // dag.augcase = true
    let aug = parseAug(dag.pcwf)
    if (aug) {
        dag.aug = aug
        let re = new RegExp('^' + dag.aug)
        dag.pcwf = dag.pcwf.replace(re, '')
        let augseg = {seg: dag.aug, aug: true}
        dag.augseg = augseg
    } else {
        dag.aug = false
    }
    // log('_============== AUG:', dag.pcwf, dag.aug)

    breaks = await cleanBreaks(dag, dag.pcwf, dbs)
    // log('_aug breaks:', dag.pcwf, breaks)
    if (!breaks.length) return chains
    let augchains = await eachBreak(dag, breaks)
    // log('_PCH', augchains.length)

    augchains.forEach(chain=> {
        // log('_augchain', chain)
        let main = chain.find(seg=> seg.main)
        if (!main) return
        let cdict = main.cdicts[0]
        if (cdict.pref) return
        // log('_xxxxxxxxxxxxxxxxxx', cdict.rdict, cdict.aug)
        if (dag.augseg) chain.unshift(dag.augseg)
        chains.push(chain)
    })
    // log('_==============:', chains.length)

    return chains
}

async function eachBreak(dag, breaks) {
    let chains = []
    // let breakids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
    // log('_break-ids', breakids)
    // log('_DAG.stressidx', dag.stressidx)

    for (let br of breaks) {
        let breakid = [br.head, br.conn, br.tail, br.fls._id].join('-')
        let headdicts = br.headdicts
        let taildicts = br.taildicts
        let pfls = br.fls.docs.filter(flex=> flex.stress == dag.stress && flex.stressidx == dag.stressidx)
        // log('_pfls', pfls)
        // let pfls = br.fls.docs
        let flexid = br.fls._id
        let head_rdicts_list = headdicts.map(dict=> dict.rdict)
        // log('_head_rdicts_list', head_rdicts_list)

        if (taildicts && taildicts.length && false) {
            let tail_rdicts_list = taildicts.map(dict=> dict.rdict) // tail_rels
            // log('_tail_rdicts_list', tail_rdicts_list)
            let dictgroups = _.groupBy(taildicts, 'dict') // cdicts из разных словарей
            for (let dict in dictgroups) {
                let cdicts = dictgroups[dict]
                let probeChains = eachProbechain(cdicts, flexid, pfls, taildicts)
                if (br.conn) {
                    let connseg = {seg: br.conn, connector: true}
                    probeChains.forEach(chain=> chain.unshift(connseg))
                }
                let reldicts = headdicts.map(dict=> dict.rdict).join(',')
                let headseg = {seg: br.head, cdicts: headdicts, reldicts}
                probeChains.forEach(chain=> chain.unshift(headseg))
                chains.push(...probeChains)
            }
        } else {
            let head_rdicts_list = headdicts.map(dict=> [dict.stem, dict.dname, dict.rdict].join('-')) // head_rels
            // log('_head_rdicts_list', head_rdicts_list)

            let stemgroups = _.groupBy(headdicts, 'stem')
            for (let stem in stemgroups) {
                let rels = stemgroups[stem]
                let dictgroups = _.groupBy(rels, 'dict') // cdicts из разных словарей; dict - строка
                for (let dict in dictgroups) {
                    let cdicts = dictgroups[dict] // dict-stem-group
                    // итого, имею корректные cdicts и rels
                    // log('_cdicts-before', dag.aug, !!dag.preftail, dict.rdict, dict.stem, dict.firstvowel, 333, dag.aug && !dict.firstvowel)
                    cdicts = cdicts.filter(dict=> {
                        if (dag.preftail) {
                            if (dict.pref && strip(dict.pref) == strip(dag.preftail.pref)) return dict
                            // else if (dict.firstvowel == dag.preftail.conn) return dict
                            else if (dict.aug == dag.preftail.conn) return dict
                            else if (!dict.pref) return dict // && !dict.firstvowel
                        } else {
                            // log('_=== AUG SEG', stem, dict.rdict)
                            if (dict.pref) return
                            // if (dag.aug && !dict.firstvowel) return
                            // else if (!dag.aug && dict.firstvowel) return
                            // log('_=== AUG SEG', stem, dict.rdict, dag.aug, dict.aug, dag.aug != dict.aug)
                            // TODO: привести к единому виду
                            if (!dict.aug) dict.aug = false
                            if (dag.aug != dict.aug) return
                            else return dict
                            // return dict
                        }
                        // log('_DICT-OK', dag.aug, dict.rdict, dict.stem, '_dag.aug:', dag.aug)
                    })
                    if (!cdicts.length) continue

                    // if (stem == 'δαιμ')  log('_cdicts.length============', cdicts.length, stem, dict)

                    let pchains = tryDictFls(cdicts, rels, pfls, flexid)
                    // log('_pchains.length', stem, dict, pchains.length)
                    chains.push(...pchains)
                    // if (pchains.length) log('_head_only_chains_', stem, dict, pchains.length)
                } // dict
            } // stem
        }
    }
    // return []
    return chains
}

function tryDictFls(cdicts, rels, pfls, flexid) {
    let poses = ['verb', 'name']
    let pchains = []
    for (let pos of poses) {
        let cpos = cdicts.filter(dict=> dict[pos])
        if (!cpos.length) continue
        let cpos_rdicts = cpos.map(doc=> [doc.dname, doc.rdict].join('-'))
        // log('_cpos_rdicts', pos, cpos_rdicts) // ***
        let probe = cpos.find(dict=> dict.dname == 'wkt') || cdicts[0]
        // log('_cpos_rdicts_probe', pos, probe.rdict)

        let cfls = []
        pfls = pfls.filter(flex=> flex.type == probe.type)
        if (!pfls.length) continue
        let conn = dag.preftail?.conn || dag.aug || ''
        conn = strip(conn)
        // if (dag.preftail?.conn && !probe.pref) connector = '' // dict - только stem при анализе слова с префиксом

        // log('_probe', pos, probe.dname, probe.rdict, probe.stem, '_prefix:', probe.pref, '_conn:', conn, '_dag_aug:', dag.aug, '_probe_aug', probe.aug) // ***

        if (probe.verb) cfls.push(...filterProbeVerb(probe, pfls, conn))
        else cfls = filterProbeName(probe, pfls)
        // log('_cfls.length', pos, probe.dname, probe.rdict, cfls.length)
        if (!cfls.length) continue
        // log('_probe_BEFORE_CHAIN', pos, probe.dname, probe.rdict, probe.stem, '_prefix:', probe.pref, '_conn:', conn)
        let chain = makeChain(probe, cdicts, rels, flexid, cfls)
        // log('_probe_AFTER_CHAIN', pos, probe.dname, probe.rdict, )
        pchains.push(chain)
    } // pos
    // log('_probe_AFTER_CHAIN_pchains', pchains.length )
    return pchains
}

function makeChain(probe, cdicts, rels, flsid, fls) {
    let chain = []
    let flsseg = {seg: flsid, fls}
    chain.push(flsseg)
    // если стем короткий, то rels не имеют смысла, много лишних
    // rels = rels.filter(dict=> dict.stem.length > 1)
    // ниже фантазия на эту тему
    rels = rels.filter(dict=> {
        let ok = false
        if (dict.stem.length > 1) ok = true
        else if (probe.type[0] == dict.type[0]) ok = true
        return ok
    })
    let reldicts = _.uniq(rels.map(dict=> dict.rdict)).join(',')
    // let tailseg = {seg: probe.stem, probe, rdict: probe.rdict, dname: probe.dname, cdicts, rels, reldicts, main: true}
    let tailseg = {seg: probe.stem, cdicts, rels, main: true}

    if (probe.verb) tailseg.verb = true
    else if (probe.name) tailseg.name = true
    // log('_T', tailseg)
    chain.unshift(tailseg)

    // if (br.head && br.tail) {
    //     let connseg = {seg: br.conn, conn: true}
    //     if (br.conn) chain.unshift(connseg)
    //     if (headdicts.length) {
    //         let reldicts = headdicts.map(dict=> dict.rdict).join(',')
    //         let headseg = {seg: br.head, cdicts: headdicts, rels: headdicts, reldicts, head: true}
    //         chain.unshift(headseg)
    //     }
    // }

    return chain
}

function filterProbeName(dict, pfls) {
    // log('_filter-D-Name =====', dict.rdict, dict.stem, dict.type, dict.dname, dict.gends) // , dict.keys
    // let dialectnames = _.keys(dict).filter(dname=> !notdialectnames.includes(dname))
    // f('_dialectnames', dialectnames)
    if (!dict.keys) {
        log('_NO DICT KEYS', dict)
        dict.keys = []
        // это пока что прочие словари
        // return []
    }

    if (!dict.gends) {
        dict.gends = ['macs', 'fem', 'neut'] // adjectives
    }

    let cfls = []
    for (let flex of pfls) {
        if (!flex.name) continue
        // cfls.push(flex)
        if (!dict.gends.includes(flex.gend)) continue
        // log('_filter-F-', dict.rdict, flex.numcase, flex.gend)
        // if (flex.gend == 'fem') log('_filter-F-', dict.rdict, flex.numcase, flex.gend)

        let key = dict.keys.find(dkey=>
            // dkey.dialect == flex.dialect  &&
            // dkey.declension == flex.declension &&
            dkey.stype == flex.stype
            // dkey[flex.gend] == flex.key
        )
        if (!key) continue

        // ==== вот это теперь можно отбросить - потому что stype однозначно определяет flex.key => нет, нельзя, не определяет. ἄγκυρα - ἀγκύρα
        if (flex.adv) key = dict.keys.find(dkey=> dkey.adv == flex.key)
        else key = dict.keys.find(dkey=> dkey[flex.gend] == flex.key)
        if (!key) continue
        // log('_filter-F-OK', dict.rdict, flex.num, flex.case, flex.gend)
        cfls.push(flex)
        // log('_filter-F-', dict.rdict, flex.numcase, flex.gend)
    }
    let fems = cfls.filter(flex=> flex.gend == 'fem')
    // log('_FEMS', dict.gends, fems.length)
    return cfls
}

// === TODO: пока только wkt. Потом добавлю typical.keys для других словарей
function filterProbeVerb(dict, pfls, conn) {
    if (!dict.verb) return []
    if (!dict.keys) dict.reg = true
    let dkeys = dict.keys ? dict.keys : vkeys[dict.type] ? vkeys[dict.type] : []
    let cfls = []
    // log('_D-verb', dict.dname, dict.rdict, dict.pref, dict.stem, dict.type, pfls.length, dict.vtypes, conn) // , pfls.length

    if (!dict.vtypes) return []

    for (let flex of pfls) {
        if (!!dict.reg != !!flex.reg) continue
        if (dict.type != flex.type) continue
        // if (dict.syllables != flex.syllables) continue
        if (flex.part) continue
        // cfls.push(flex)

        // if (dict.vtypes[flex.stype]) {
        //     // log('_xxxxxxxxxxxxxxxxxxx', dict.rdict, flex.stype, dict.vtypes[flex.stype].ind, 'conn:', conn, dict.vtypes[flex.stype].ind != conn)
        //     if (flex.mood == 'ind' && strip(dict.vtypes[flex.stype].ind) != conn) continue
        //     else if (flex.mood != 'ind' && strip(dict.vtypes[flex.stype].soi) != conn) continue
        // } else {
        //     // log('_FLEX', flex)
        //     if (conn) continue
        //     // log('_yyyyyyyyyyyyyyyyyyyyy', dict.rdict, flex.stype, dict.vtypes[flex.stype], 'conn:', conn, !!conn, !!flex.conn, !!conn != !!flex.conn)
        // }

        // log('_F', dict.rdict, dict.stem, dict.type, '_vtypes', flex.stype,  '->', dict.vtypes[flex.stype], 'CONN:', conn, flex.mood)

        let fkeys = dkeys[flex.tense]
        if (!fkeys) continue
        if (!fkeys.includes(flex.key)) continue

        // log('_F_OK', dict.rdict, dict.stem, dict.type, '_vtypes', flex.time, flex.stype,  '->', dict.vtypes[flex.stype], 'CONN:', conn, flex.tense)
        cfls.push(flex)
    }
    // log('_CFLS', cfls.length)
    return cfls
}

function filterProbePart(dict, pfls) {
    // log('_filter-Dict-Part =====', dict.rdict, dict.stem, dict.type, dict.dname)
    if (!dict.verb || !dict.reg) return []
    let cfls = []
    let dkeys = dict.keys ? dict.keys : vkeys[dict.type] ? vkeys[dict.type] : []
    // log('_Part keys', dict.rdict) // , dkeys
    for (let flex of pfls) {
        if (!flex.part) continue

        // if (dict.type != flex.type) continue
        // log('_PF', flex.term)
        cfls.push(flex)

        let fkeys = dkeys[flex.type]?.[flex.tense]
        // log('_Fkeys', flex.type, flex.tense, fkeys)
        if (!fkeys) continue
        // log('_PF', flex.key)
        if (!dkeys.includes(flex.terms)) continue
        cfls.push(flex)
        // log('_P-KEYS', partkeys)
    }
    // log('_P-CFLS', cfls.length)
    return cfls
}

function removeVowelEnd(pref) {
    if (pref == '') return {pref, conn: ''}
    else return {pref, conn: ''}
}

function removeVowelBeg(wf) {
    let beg = wf[0]
    while (beg) {
        if (vowels.includes(beg)) {
            wf = wf.slice(1)
            beg = wf[0]
        } else {
            beg = false
        }
    }
    return wf
}

// clean breaks - только те, которые состоят из обнаруженных в словарях stems
async function cleanBreaks(dag, pcwf, dbs) {
    let breaks = makeBreaks(pcwf, dag.flexes)
    if (!breaks.length) return []
    let dicts = await findDicts(breaks, dbs)
    // log('_BR', breaks, dicts)

    breaks.forEach(br=> {
        // log('_BR', br.head, br.conn, br.tail, 'fls', br.fls._id)
        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        // if (br.head == 'γοραζ') log('_XXXX', br.head, headdicts.length)
        let rdicts = headdicts.map(dict=> dict.rdict)
        // log('_HEAD-RDICTS', br.head, rdicts)
        if (headdicts.length) br.headdicts = headdicts

        let taildicts = dicts.filter(dict=> dict.stem == br.tail)
        taildicts = taildicts.filter(dict=> dict.stem.length > 2) // очень много лишних, маловероятных схем, ex: γαλ-α-ξ-ίου

        taildicts = taildicts.filter(dict=> vowDictMapping(br.conn, dict))

        if (taildicts.length) {
            headdicts = headdicts.filter(dict=> dict.stem.length > 2)
            taildicts = taildicts.filter(dict=> {
                if (dict.name) return true
                else if (dict.verb && dict.reg) return true
            })
            headdicts = headdicts.filter(dict=> {
                if (dict.name) return true
                else if (dict.verb && dict.reg) return true
            })
            br.headdicts = headdicts
            br.taildicts = taildicts
        }
    })

    breaks = breaks.filter(br=> {
        let ok = false
        if (br.headdicts?.length && !br.tail) ok = true
        if (br.headdicts?.length && br.taildicts?.length) ok = true
        return ok
    })
    return breaks
}

function vowDictMapping(conn, dict) {
    // log('_vowDictMapping,conn, dict.aug', conn, dict.rdict, dict.verb, dict.aug, conn == dict.aug)
    let mapping = false
    if (dict.name) {
        if (dict.aug == conn) mapping = true
        else if (!dict.aug && !conn) mapping = true
        else if (!dict.aug && ['υ', 'xxx'].includes(conn))  mapping = true // βαρύτονος
        // else if (!dict.aug && conn) mapping = true // βαρύτονος - или сделать includes, как в verb?
    } else if (dict.verb) {
        if (dict.aug == conn) mapping = true
        if (!dict.aug) dict.aug = ''
        // log('_MAPPING-aug', dict.rdict, dict)
        // log('_MAPPING', dict.rdict, 1, conn, 2, dict.aug, 3, dict.aug == conn)
        if (!dict.aug && !conn)  mapping = true
        else if (!dict.aug && ['ο', 'α', 'ἐ'].includes(conn))  mapping = true // ἀγαθοποιέω
        else if (strip(dict.aug) == strip(conn))  mapping = true
        // mapping = true
    }
    // log('_MAPPING FINAL', mapping)
    return mapping
}

function findConnector(pstr) {
  let vow = pstr[0]
  let conn = ''
  while(vowels.includes(vow)) {
    pstr = pstr.slice(1)
    conn += vow
    vow = pstr[0]
  }
  return conn
}

// only two parts, but the second can be divided into connector and a tail itself
// last part may begin with accent
function makeBreaks(pcwf, flexes) {
    let breaks = []
    for (let fls of flexes) {
        let pterm = plain(fls._id)
        let phead = pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, conn = '', res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head) continue
            // if (!head || vowels.includes(_.last(head))) continue // зачем я это добавил?
            // todo: наверное, на след шагу в conn чтобы сразу добавить гласную
            // но в простейшем ἀγαθοποιέω окончание έω, а head заканчивается на гласную, отбросить гласную здесь нельзя
            tail = phead.slice(pos)
            conn = findConnector(tail)
            if (conn) {
                let re = new RegExp('^' + conn)
                tail = tail.replace(re, '')
                if (!tail) continue
                res = {head, conn, tail, fls}
                // log('_BR_c', head, conn, fls._id)
            } else {
                // log('_BR', head, tail, fls._id)
                res = {head, conn, tail, fls}
            }
            /* if (!tail) continue */ // нельзя, если simple
            if (tail && head.length < 3) continue // в компаундах FC не короткие, но в simple короткие м.б.
            breaks.push(res)
        }
    }
    return breaks
}

async function findDicts(breaks, dbs) {
    let headkeys = _.uniq(breaks.map(br=> br.head))
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    let keys = _.compact(headkeys.concat(tailkeys))
    // keys = ['δεικν']
    // log('_findDicts_keys', keys)
    let dicts = await getDicts(keys, dbs)
    dicts = dicts.filter(dict=> !dict.indecl)
    // log('_findDicts', dicts)
    dag.dictids = _.uniq(dicts.map(ddict=> ddict.stem))
    d('_dag.dictids', dag.dictids)
    return dicts
}

function parsePrefix(wf) {
    let prefstr = '', re
    for (let pref of preflist) {
        re = new RegExp('^' + pref.replace(/-/g, ''))
        if (!re.test(wf)) continue
        if (prefstr.length < pref.length) prefstr = pref
    }
    return prefstr
}

// compound - προσαναβαίνω; ἀντιπαραγράφω; ἀποδείκνυμι; ἀναβλέπω // αὐτοχολωτός, χολωτός
function makePrefDocs(cwf) {
    let pcwf = plain(cwf)
    let prefraw = parsePrefix(pcwf)
    if (!prefraw) return []
    let prefs = prefraw.split('-')
    if (prefs.join('') == pcwf) return []

    let tails = []
    let tail = cwf
    let full = ''
    let tdocs = []
    prefs.forEach(pref=> {
        full += pref
        let repref = new RegExp('^' + pref)
        tail = tail.replace(repref, '')
        let ptail = plain(tail)
        if (tail == cwf) tail = ptail.replace(repref, '')
        // log('_================', cwf, pref, tail)
        let shorttail = removeVowelBeg(tail)
        let retail = new RegExp(shorttail + '$')
        let conn = tail.replace(retail, '')

        // if (pref == 'δι') conn = ''
        // else if (pref.endsWith('ι')) {
        //     conn = 'ι'
        //     pref = pref.replace(/ι$/, '')
        // }

        let taildoc = {pref, conn, tail: shorttail}
        if (full != pref) taildoc.full = full
        let prefdoc = prefdocs.find(prefdoc=> strip(prefdoc.dict) == strip(pref))
        tdocs.push(prefdoc)
        taildoc.docs = _.clone(tdocs)
        tails.push(taildoc)
    })

    return tails.reverse()
}

async function parsePrefChains(dag, preftails, dbs) {
    if (!preftails.length) return []
    let preftail = _.first(preftails)
    dag.preftail = preftail
    // log('_================= preftail', preftail)
    let ptail = plain(preftail.tail)
    let breaks = await cleanBreaks(dag, ptail, dbs)
    let prefchains = await eachBreak(dag, breaks)
    for (let preftail of preftails) {
        // log('_========', preftail.pref)
        for (let prefchain of prefchains) {
            let main = prefchain.find(seg=> seg.main)
            let probe = main.cdicts[0]
            // log('_==================================== main_pref', main.pref, main.rdict, preftail.pref)
            if (!probe.pref) prefchain.unshift(preftail)
        }
    }
    // log('_===', prefchains)

    return prefchains
}
