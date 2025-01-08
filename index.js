const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, stresses, checkOddStress } from './lib/utils.js'
import { createDBs, getFlexes, getDicts, getNests, getInds } from './lib/remote.js'
import { enclitic } from './lib/enclitic.js'
import { prettyName, prettyVerb, guessPrefix } from './lib/utils.js'
import Debug from 'debug'

// KEYS
import { nameKey } from '../parse-dicts/WKT/wkt-keys/key-name.js'
// import { nounKey } from '../parse-dicts/WKT/wkt-keys/key-noun.js'
// import { adjKey } from '../parse-dicts/WKT/wkt/wkt-keys/key-adj.js'
import { verbKey } from '../parse-dicts/WKT/wkt-keys/key-verb.js'

// let nounKey, adjKey, verbKey = {}

import { preflist } from './lib/prefix/preflist.js'
import { prefDocList } from '../prefslist/dst/prefDocList.js'

const d = Debug('app')
const b = Debug('break')
const n = Debug('chain')
const f = Debug('filter')
const c = Debug('compound')
const o = Debug('probe')
const a = Debug('aug')

// let dag = {}

log('_ANTHRAX START')

export async function anthrax(wf) {
    if (!wf) return []
    // await createDBs(dnames)

    let chains = []
    let dag = await parseDAG(wf)

    let idicts = await getInds(dag.cwf)
    // log('_INDECLS', idicts)
    if (idicts.length) {
        let ichain = makeTermChain(wf, idicts)
        chains.push(ichain)
    }

    // log('_DAG', _.keys(dag))
    // ======================== ἀνακύκλωσις
    // pref - есть, а в WKT слово - νακυκλ -без префикса

    // false prefix: ἡμέραι

    let leads = []
    let leadPrefs = parsePrefSeg(dag.pcwf)
    if (leadPrefs) leads.push(...leadPrefs)

    // log('_leadPrefs', leadPrefs)
    //  { pref: 'προσαν', con: 'α', tail: 'μιμνησκω' }

    // ἀνακύκλωσις - pref = null // ==== значит, надо оба варианта, пока в словаре все слова точно не будут обработаны на префиксы - ἀνακύκλησις
    // или просто подождать DVR, LSJ, там есть - κλῆσις
    let leadAug = parseAug(dag.pcwf)
    if (leadAug) leads.push(leadAug)

    // log('_leads', leads)
    // return []

    for (let lead of leads) {
        let brchains = await main(dag, lead)
        chains.push(...brchains)
    }

    // отбросить короткие стемы ; ἡμέρα
    if (chains.length > 1 && false) {
        chains = chains.filter(chain=> chain.cdict.stem.length > 1)
    }

    // πολυμαθίη νόον ἔχειν οὐ διδάσκει
    // let cdicts = dicts.filter(dict=> dict.dict == chain.cdict.dict && dict.pos == chain.cdict.pos)
    // await addTrns(chains)

    return chains
}

async function main(dag, lead) {
    let ptail = lead.tail

    let headtails = parseHeadTails(dag, ptail)
    // log('_headtails', ptail, headtails)
    let dictbreaks = await parseDictBreaks(headtails, dag.termflex)
    // log('_dictbreaks', dictbreaks)

    let br_strs = dictbreaks.map(br=> ['_head:', br.head, br.term].join(' - '))
    // log('_br_strs', lead.aug, br_strs)

    let chains = []
    for (let br of dictbreaks) {
        let fls = dag.termflex[br.term]
        if (!fls) continue
        let brchains = probeForFlex(lead, br, fls)
        chains.push(...brchains)
    }

    return chains
}

function probeForFlex(lead, br, fls) {
    // log('_____________p_robeForFlex', lead, '_head', br.head, '_con', br.con, br.headdicts.length)
    if (br.taildicts.length && !br.headdicts.length) return []
    if (!br.taildicts.length && br.con) return []

    let compound = !!br.taildicts.length && !!br.headdicts.length
    // if (compound) return []

    let maindicts = (compound) ? br.taildicts : br.headdicts
    // log('___compound', compound, 'lead:', lead)
    // log('___maindicts', maindicts.length)
    if (!maindicts.length) return []
    let stem = (compound) ? br.tail : br.head

    let mainrdicts = _.uniq(maindicts.map(cdict=> cdict.rdict))
    // log('_M br.head Mainrdicts', br.head, mainrdicts)

    // log('_br', br.head, br.hsize, 'con', br.con,  '_tail:', br.tail, br.tsize, '_term:', br.term, 'compound', compound)
    // let proxies = (compound) ? proxyByConnector(br.con, maindicts) : proxyByLead(lead, maindicts)

    // let proxies = maindicts.filter(cdict=> {
        // if (lead.pref && cdict.prefix) return true
    // })

    let proxies = maindicts
    let rproxies = proxies.map(cdict=> cdict.rdict)

    // log('_a_lead:', lead)
    // log('_a_br:', 'compound', compound, 'head', br.head, 'tail:', br.tail)
    // log('_a_proxies_rdicts:', 'compound', compound, 'rdicts:', rproxies)

    if (!proxies.length) return []

    // log('_fls', fls.length)
    fls = fls.filter(flex=> {
        return true
        if (lead.pref) {
            flex.con == lead.con
        } else {
            flex.aug == lead.aug
        }
    })

    if (!fls.length) return []

    let nfls = fls.filter(flex=> flex.name)
    let advfls = fls.filter(flex=> flex.adverb)
    let vfls = fls.filter(flex=> flex.verb)
    // let pfls = fls.filter(flex=> flex.part)

    // log('_lead', br.head, lead)
    // log('_fls', br.head, fls.length)
    // log('_vfls', br.head, vfls.length)

    // log('_fls', fls.length)
    // TODO: αἴθων - Αἴθων - оба nouns ; nest неверно считает cstype ; а makeWKT неверно считает tgen

    let brchains = []
    let stemdicts = []

    for (let cdict of proxies) {
        if (cdict.person) continue // TODO::
        // proxies = proxies.filter(cdict=> cdict.rdict == 'ἀμφιβάλλω') // amfiballo

        // if (cdict.rdict != 'παρακρύπτω') continue // RFORM ; βάρακος

        // if (cdict.stem != 'γλαυξ') continue
        // ============= NB: Λυκάων - есть в noun и person. совпадают и rdict и dict, и путаются. Нужен аккурантый person: true
        // log('_cdict', cdict.rdict)

        if (!cdict.ckeys) continue // βάδην

        // =======================================================================================================================
        // παρακρύπτω παρέκρυπτον - закомментировал prefix παρέκ
        // HERE - что делать? maindicts вычисляются уже с использование lead.pref, то есть неверно
        // =======================================================================================================================

        // log('_B_CURPREF', cdict.rdict, cdict.psize)
        // let curpref = guessPrefix(cdict.rdict, cdict.psize)
        // log('_CURPREF', '_L', lead)

        // if (!cdict.name) continue // NAME

        for (let ckey of cdict.ckeys) {
            // log('_K', cdict.rdict, ckey.tense, ckey.con, ckey.prefix.con, '_L', lead.con)
            // log('_CK', cdict.rdict, cdict.ckeys, '_L', lead.aug)
        }

        // log('____probe_0', cdict.rdict, cdict.stem, 'fls', fls.length, lead) // , cdict.stypes
        let ckeys = cdict.ckeys
        ckeys = cdict.ckeys.filter(ckey=> {
            let ok = true
            // return ok
            // =======================================================================================================
            // здесь есть случай, когда нужно пересчитать lead-prefix в зависимости от cdict: παρακρύπτω / παρέκρυπτον
            // =======================================================================================================
            if (lead.pref) { // wf with prefs, с тем же стемом
                if (!ckey.prefix && ckey.bad) ok = false // должен быть prefix, но его нет
                else if (!ckey.prefix) ok = true // shorts // TODO: aug ~ connector
                // both prefs, regulars:
                if (ckey.prefix && (ckey.prefix.pref !== lead.pref || ckey.con !== lead.con)) ok = false
                // if (ckey.prefix && (ckey.prefix.pref !== lead.pref || ckey.prefix.con !== lead.con)) ok = false
                // log('________ckeys lead pref', cdict.rdict, 'ckey.prefix?.pref', ckey.prefix?.pref, 'lead_pref', lead.pref)
            } else { // целые, без префикса
                if (ckey.prefix) ok = false
                // if (ckey.bad) ok = false // так я все bads убил, не верно
                else if (ckey.aug !== lead.aug) ok = false
                // log('________ckeys aug ok: ', ok, cdict.rdict, 'ckey.aug', ckey.aug, 'lead_aug', lead.aug)
            }
            // if (ok) log('________ckeys lead aug ', cdict.rdict, 'lead_pref', lead.pref, 'ckey.prefix', ckey.prefix)
            return ok
        })

        // let xkeys = ckeys.filter(ckey=> ckey.tense == 'pres.act.inf')
        // log('_X KEYS', cdict.rdict, cdict.stem, xkeys)
        // ckeys = cdict.ckeys

        // let tenses = cdict.ckeys.map(ckey=> ckey.tense)
        // log('_CKEYS', cdict.rdict, tenses)

        cdict.ckeys = ckeys
        if (!ckeys.length) continue

        // log('____probe', cdict.rdict, cdict.stem, 'fls', fls.length, lead) // , cdict.stypes

        let cfls = []
        if (cdict.name) {
            for (let flex of nfls) {
                // if (cdict.rstress != flex.rstress) continue // различить γλῶττα / φάττα - разные ударения
                for (let ckey of ckeys) {
                    // if (!ckey.keys) log('_no_ckeys', cdict.rdict) // TODO:
                    if (!flex.adverb) {
                        if (ckey.stype != flex.stype) continue
                        if (ckey.gend != flex.gend) continue
                    }
                    if (!ckey.keys.includes(flex.key)) continue
                    cfls.push(flex)
                    // log('_F_Name_OK', flex)
                }
                // if (flex.adverb || ckeys.includes(flex.key)) cfls.push(flex)
            }
            for (let flex of advfls) {
                let keys = cdict.var?.[flex.stype] //  || nameKey[flex.stype] ??
                if (!keys) continue
                cfls.push(flex)
            }
        } else if (cdict.verb) {
            // log('_C', cdict.rdict)
            for (let flex of vfls) {
                // log('_F', flex.tense)
                // cfls.push(flex)
                for (let ckey of ckeys) {
                    // if (!ckey.keys) log('_no_ckeys', cdict.rdict) // TODO:
                    if (ckey.lead != flex.lead) continue
                    if (ckey.stype != flex.stype) continue
                    if (ckey.tense != flex.tense) continue
                    if (!ckey.keys.includes(flex.key)) continue
                    cfls.push(flex)
                    ckey.ok = true
                    // log('_F_Verb_OK', cdict.rdict, flex.tense)
                }
            }
        }

        if (!cfls.length) continue
        cdict.cfls = cfls

        let okckeys = cdict.ckeys.filter(ckey=> ckey.ok)
        // log('__OKCK', cdict.rdict, cdict.stem, okckeys)
        cdict.ckeys = okckeys

        // log('probe_ok', cdict.pos, cdict.rdict, cdict.stem,  '_cfls:', cdict.cfls.length)

        stemdicts.push(cdict)

    } // proxy cdict

    // log('__________________LEAD', lead)

    if (!stemdicts.length) return []

    let dictgroups = _.groupBy(stemdicts, 'dict')  // общий stem, term - разные cdict.dict, verb/name, -> и chains ; noun / adj - вместе

    for (let dict in dictgroups) {
        let cdicts = dictgroups[dict]

        let probe = cdicts[0] // определить pos и scheme  // ἀντιδιαβάλλω
        if (!probe) log('_NO_P_ROBE_DICT___!!!', dict, maindicts.length, cdicts)

        let probeFLS = {dict, cdicts, rels: maindicts, term: br.term}
        if (probe.verb) probeFLS.verb = true
        else probeFLS.name = true

        // log('_BR-lead', lead)
        // log('_BR', br.head, br.con, br.tail)
        let scheme = parseScheme(lead, probe, br)
        probeFLS.scheme = scheme

        parseMorph(cdicts)

        // log('_XXXXXXXXXXXXXXXXX probeFLS', probeFLS)
        brchains.push(probeFLS)
    }

    for (let probeFLS of brchains) {
        cleanChain(probeFLS)
    }
    // log('_XXXXXXXXXXXXXXXXXx', brchains.length)
    // return []
    return brchains
}

function cleanChain(chain) {
    for (let cdict of chain.cdicts) {
        delete cdict.vars
        delete cdict.cfls
        // delete cdict.stem
        // delete cdict.astem
        // delete cdict.aug
        delete cdict.proxy
        delete cdict.dname
        delete cdict.raw
        delete cdict.compound
        delete cdict.cstype
        // cdict.sprefix = JSON.stringify(cdict.prefix)
    }
    for (let cdict of chain.rels) {
        delete cdict.vars
        delete cdict.cfls
        // delete cdict.stem
        // delete cdict.astem
        // delete cdict.aug
        delete cdict.proxy
        delete cdict.dname
        delete cdict.raw
        delete cdict.compound
        delete cdict.cstype
    }
}

function parseMorph(cdicts) {
    let morphs = []
    for (let cdict of cdicts) {
        if (cdict.name) morphs = prettyName(cdict.cfls)
        else if (cdict.verb) morphs = prettyVerb(cdict.cfls)
        cdict.morphs = morphs
        // log('_chain.morphs', cdict.rdict, cdict.morphs)
    }
}

function parseScheme(lead, probe, br) {
    let scheme = []
    // если cdict уже имеет префикс, то это полная форма, с коротким стемом
    // а может быть, что noun имеет prefix, а adjective или verb - нет? Кажется, может. И что будет? Это нужно проверять при заливке Nest
    if (lead.pref) {
        // log('_______________________P', probe.rdict, probe.prefix)
        if (probe.prefix) {
            let segs = []
            segs.push(lead.pref)
            if (lead.con) segs.push(lead.con)
            segs.push(probe.stem)
            let seg = segs.join('')
            scheme.push({seg, dict: probe.dict, stem: true})
        } else {
            scheme.push({seg: lead.pref, dict: lead.pref, pref: true})
            if (lead.con) scheme.push({seg: lead.con, con: true})
            scheme.push({seg: probe.stem, dict: probe.dict, stem: true})
        }
    } else {
        // log('_______________________NO P', probe.rdict, br.head)
        scheme.push({seg: br.head, dict: br.head, pref: true})
        if (br.con )scheme.push({seg: br.con, con: true})
        scheme.push({seg: br.tail, dict: probe.dict, stem: true})
    }
    scheme.push({seg: br.term, dict: br.term, term: true})
    // log('_SCHEME', scheme)
    return scheme
}

function parseHeadTails(dag, ptail) {
    let headtails = [] // possible stems
    for (let term of dag.flsterms) {
        let pterm = plain(term)
        let reterm = new RegExp(pterm + '$')
        let stub = ptail.replace(reterm, '')
        if (stub == ptail) continue
        // log('_STUB', lead, term, '_stub:', stub) // SHOW
        let qheadtails = parseHeadTail(stub, term)
        headtails.push(...qheadtails)
    }
    return headtails
}

async function parseDictBreaks(headtails) {
    let psblstems = [] // possible stems
    psblstems.push(...headtails.map(ht=> ht.head))
    psblstems.push(...headtails.map(ht=> ht.tail))
    psblstems = _.uniq(_.compact(psblstems))
    // let dicts = await findDicts(psblstems)
    let dicts = await getNests(psblstems)
    // log('_dicts', dicts.length)

    for (let ht of headtails) {
        let headdicts = dicts.filter(dict=> dict.stem == ht.head)
        let taildicts = dicts.filter(dict=> dict.stem == ht.tail)
        ht.headdicts = headdicts
        ht.taildicts = taildicts
        ht.hsize = headdicts.length
        ht.tsize = taildicts.length
    }
    return headtails
}

function filterVerb(variant, vfls) {
    let cfls = []
    // log('____VER', variant.tense)
    for (let flex of vfls) {
        // log('____flex', flex.gend, variant.gend)
        if (variant.stype != flex.stype) continue
        if (variant.tense != flex.tense) continue
        if (!variant.keys.includes(flex.key)) continue
        cfls.push(flex)
    }
    // log('____cfls ok', cfls.length)
    // return vfls
    return cfls
}

function filterName(variant, nfls) {
    let cfls = []
    for (let flex of nfls) {
        if (variant.gend != flex.gend) continue
        if (!variant.keys.includes(flex.key)) continue
        cfls.push(flex)
    }
    // log('____cfls ok', cfls.length)
    return cfls
}

function parseHeadTail(stub, term) {
    // log('_LEAD', stub, term)
    let pairs = []
    let pstub = plain(stub)
    let head = ''
    let tail = pstub
    let con = ''
    let pos = stub.length + 1
    while (pos > 0) {
        // log('_==========================', stub, head, tail)
        pos--
        head = stub.slice(0, pos)
        if (!head) continue
        tail = stub.slice(pos)
        if (tail && head && head.length < 2) continue
        con = findConnector(tail)
        if (con) {
            let re = new RegExp('^' + con)
            tail = tail.replace(re, '')
            if (!tail) continue
            if (tail && tail.length < 2) continue
            // log('_BR_con', head, con, tail, 'flex:', fls._id)
        } else {
            // continue
        }
        if (head && tail && !con) continue

        let stress = term[0]
        if (stresses.includes(stress)) term = term.slice(1)

        let ht = {head, con, tail, term}
        pairs.push(ht)
    }
    return pairs
}

async function parseDAG(wf) {
    let dag = new Map();
    dag.wf = wf
    let cwf = oxia(comb(wf))
    dag.cwf = checkOddStress(cwf)
    dag.pcwf = plain(dag.cwf)

    let {stressidx, stress} = getStress(dag.cwf)
    // log('_STRESS', stress, stressidx)

    let flakes = scrape(dag.cwf).reverse()
    if (!flakes.length) return
    // dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)
    // log('_flakes_tails', tails)

    let idfls = await getFlexes(tails)
    let fls = _.flatten(idfls.map(idflex=> idflex.docs))
    // STRESS - как сказывается на префиксах?
    fls = fls.filter(flex=> flex.stress == stress && flex.stressidx == stressidx)
    dag.fls = fls
    dag.flsterms = _.uniq(dag.fls.map(flex=> flex.term))
    // log('_flsterms', dag.flsterms)

    dag.termflex = {}
    for (let term of dag.flsterms) {
        let termfls = dag.fls.filter(flex=> flex.term == term)
        dag.termflex[term] = termfls
    }
    return dag
}

// просто, если часть префикса начинается с гласной, добавить тонкое придыхание. Пока на густое забить. И выяснить, если-ли вообще приставки с густым?
function parsePrefSeg(pcwf) {
    let prefraw = parsePrefix(pcwf)
    if (!prefraw) return // {pref: '', con: '', tail: ''}

    let pparts = prefraw.split('-')
    let psize = pparts.length

    let psegs = []
    let pref = pparts.join('')
    while (pparts.length) {
        // log('__pref', pref)
        let pseg = {pprefs: []}
        let parts = _.clone(pparts)
        if (parts.length < psize) pseg.pprefs = parts
        pseg.pref = pref
        let ppref = pseg.pprefs.join('')
        let repref = new RegExp('^' + ppref + pref)
        let atail = pcwf.replace(repref, '')
        let { con, tail } = removeVowelBeg(atail)
        pseg.con = con
        pseg.tail = tail

        pref = pparts.pop()
        if (!pseg.pprefs.length) delete pseg.pprefs
        psegs.push(pseg)
    }

    return psegs
}

function parsePrefix(pcwf) {
    let prefraw = '', re
    for (let pref of preflist) {
        re = new RegExp('^' + pref.replace(/-/g, ''))
        if (!re.test(pcwf)) continue
        // log('_pre', pref)
        if (prefraw.length < pref.length) prefraw = pref
    }
    return prefraw
}

// ====================================

function findConnector(pstr) {
  let vow = pstr[0]
  let con = ''
  while(vowels.includes(vow)) {
    pstr = pstr.slice(1)
    con += vow
    vow = pstr[0]
  }
  return con
}

function removeVowelBeg(wf) {
    let tail = wf
    let beg = tail[0]
    while (beg) {
        if (vowels.includes(beg) || stresses.includes(beg)) {
            tail = tail.slice(1)
            beg = tail[0]
        } else {
            beg = false
        }
    }
    let retail = new RegExp(tail)
    let con = wf.replace(retail, '')
    return {con, tail}
}

function removeVowelEnd(wf) {
    let end = wf[wf.length-1]
    if (vowels.includes(end)) wf = wf.slice(0, -1)
    return wf
}

function makeTermChain(wf, termcdicts) {
    let termchain = {dict: wf, indecl: true, rels: [], scheme: []} // TODO: scheme тут ьожет быть - astem-term
    // parseMorph(termcdicts)
    termchain.cdicts = termcdicts
    return termchain
}


async function addTrns(chains) {
    let dictkeys = []
    for (let chain of chains) {
        if (chain.indecl) continue
        let cdictkeys = chain.rels.map(cdict=> cdict.dict)
        dictkeys.push(...cdictkeys)
    }

    dictkeys = _.uniq(dictkeys)
    // log('_TRNS_dictkeys', dictkeys)

    let trnsdicts = await getDicts(dictkeys)
    // log('_TRNS_tdicts', tdicts.length)
    let trns_rdicts = trnsdicts.map(cdict=> cdict.rdict)
    // log('_TRNS_trdicts', trns_rdicts)

    for (let chain of chains) {
        if (chain.indecl) continue
        for (let cdict of chain.rels) {
            cdict.trn = {}
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            // cdict.trns = tdict.trns
            for (let tdict of tdicts) {
                cdict.trn[tdict.dname] = tdict.trns
            }
        }
        for (let cdict of chain.cdicts) {
            cdict.trn = {}
            let tdicts = trnsdicts.filter(tdict=> tdict.dict == cdict.dict && tdict.rdict == cdict.rdict && tdict.pos == cdict.pos)
            for (let tdict of tdicts) {
                cdict.trn[tdict.dname] = tdict.trns
            }
        }
    }

}

function proxyByConnector(con, dicts) {
    let proxies = []
    for (let cdict of dicts) {
        if (con != cdict.aug) continue // соответствие Second Component и BR
    }
    return []
    return proxies
}

function proxyByLead(lead, dicts) {
    let proxies = []
    for (let cdict of dicts) {
        if (lead.pref) {
            // if (cdict.aug) continue
            if (!cdict.prefix) proxies.push(cdict)  // составной chain с префиксом
            else if (lead.pref == cdict.prefix.pref) proxies.push(cdict)
            cdict.test_pref = true
            // log('_lead_pref', cdict.rdict, 'lead.pref:',lead.pref, 'cdict.prefix.pref', cdict.prefix?.pref)
            // в имперфекте con должен быть сильный, ἀμφιβάλλω - если коннектор 'ι', то имперфект отбросить, // TODO: сделано?

        } else { // if (lead) // lead.aug can be ''
            // log('____lead aug_', cdict.rdict, 'l_aug', lead.aug, 'c_aug', cdict.aug, lead.aug == cdict.aug, '_prefix', cdict.prefix)
            if (cdict.prefix) continue
            // proxies.push(cdict)
            if (lead.aug == cdict.aug) proxies.push(cdict)
            else if (lead.aug == 'ἠ' && cdict.aug == 'ἀ') proxies.push(cdict) // imperfects // должен быть полный метод, все случаи
            else if (lead.aug == 'ἐ' && !cdict.aug) proxies.push(cdict) // imperfects // должен быть полный метод, все случаи
            else if (!lead.aug && !cdict.aug) proxies.push(cdict)
            cdict.test_cdict_aug = true
        }
        // log('____xxxxxxxxxxxxxxxxx_', cdict.rdict, '_aug', lead.aug)
    }
    return proxies
}
