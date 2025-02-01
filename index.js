const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, stresses, checkOddStress } from './lib/utils.js'
import { createDBs, getFlexes, getNests, getInds } from './lib/remote.js'
// import { enclitic } from './lib/enclitic.js'
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

const d = Debug('lead')
const b = Debug('break')
const n = Debug('chain')
const f = Debug('filter')
const c = Debug('compound')
const o = Debug('probe')
const h = Debug('scheme')

// let dag = {}
// log('_ANTHRAX START')

export async function anthrax(wf) {
    if (!wf) return []

    log('_ANTHRAX WF', wf)
    wf = wf.split('?')[0]

    let chains = []
    let dag = await parseDAG(wf)

    let idicts = await getInds(dag.cwf)
    // log('_INDECLS', idicts)
    if (idicts.length) {
        let ichain = makeTermChain(wf, idicts)
        chains.push(ichain)
    }

    // ======================== ἀνακύκλωσις
    // pref - есть, а в WKT слово - νακυκλ -без префикса

    // false prefix: ἡμέραι
    // // ἀνακύκλωσις - pref = null // ==== значит, надо оба варианта, пока в словаре все слова точно не будут обработаны на префиксы - ἀνακύκλησις

    let leads = parseLeads(dag.pcwf)
    d('_LEADS', leads)

    for (let lead of leads) {
        let brchains = await main(dag, lead)
        chains.push(...brchains)
    }

    // отбросить короткие стемы ; ἡμέρα
    if (chains.length > 1 && false) {
        chains = chains.filter(chain=> chain.cdict.stem.length > 1)
    }

    let schemes = chains.map(chain=> chain.scheme.map(segment=> segment.seg).join('-'))
    h('\n_SCHEMES:', schemes.sort().join('; '))

    return chains
}

// εξαναλισκω ; συγκαθαιρεω
function parseLeads(pcwf) {
    let leads = []
    let prefraw = parsePrefix(pcwf)
    if (!prefraw) {
        let augLead = parseAug(pcwf)
        leads.push(augLead)
        return leads
    }

    // {pref: '', con: '', tail: ''}
    let pparts = prefraw.split('-')
    let psize = pparts.length

    let tail = pcwf
    let con = ''
    // let ppref = ''
    let ps = []
    let atail = ''
    // let plead = {ps: []}
    for (let pref of pparts) {
        // if (pref == 'αν') pref = 'ἀν'
        let plead = {}
        plead.ps = _.clone(ps)
        plead.pref = pref
        let before = tail
        let repref = new RegExp('^' + pref)
        // plead.a_tail = atail
        // plead.tail_b = tail
        // atail = atail ? atail.replace(repref, '') : tail.replace(repref, '')
        atail = tail.replace(repref, '')
        // plead.atail = atail
        tail = atail
        ps.push(pref)

        // if (plead.pref == 'αν') plead.pref = 'ἀν' // <<<<<<<<<<<<<<<<<<<<<, HERE // ἐξαναλίσκω
        let pct = removeVowelBeg(atail)
        plead.con = pct.con
        plead.tail = pct.tail
        leads.push(plead)

        let alead = {ps: plead.ps}
        let act = removeVowelBeg(before)
        alead.aug = act.con
        alead.tail = act.tail
        leads.push(alead)
    }

    h('_leads_', leads)
    // return []
    return leads
}

// πολυμαθίη νόον ἔχειν οὐ διδάσκει // polumathih
async function main(dag, lead) {
    let ptail = lead.tail
    let headtails = parseHeadTails(dag, ptail)
    headtails = headtails.filter(ht=> !ht.tail) // only heads, compounds killed // προσκομίζω - προσεκόμιζε // появляется лишний результат
    // log('_headtails_lead', lead)
    // log('_headtails', ptail, 'lead_pref', !!lead.pref,  headtails)
    let dictbreaks = await parseDictBreaks(headtails, dag.termflex)
    // log('_dictbreaks', dictbreaks)

    let br_strs = dictbreaks.map(br=> ['_head:', br.head, br.term].join(' - '))
    // log('_br_strs', br_strs)

    let chains = []
    for (let br of dictbreaks) {
        let fls = dag.termflex[br.term]
        // filterFLS, test
        // fls = fls.filter(flex=> {
        //     let ok = true
        //     // if (lead.con && !flex.con && !flex.aug) ok = false
        //     return ok
        // })
        if (!fls) continue
        let brchains = breakForChain(lead, br, fls)
        chains.push(...brchains)
    }

    return chains
}

function filterMainDicts(br) {
    // log('_____________filterMainDicts', '_head', br.head, '_con', br.con, br.headdicts.length)
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
    // log('_Main Rdicts br.head', br.head, mainrdicts)
    return maindicts
}

function filterProxies(lead, maindicts) {
    // log('_______________________________________________________________________F PR')
    let proxies = []
    for (let cdict of maindicts) {
        // if (cdict.stem != 'λισκ') continue
        // if (cdict.rdict != 'προσκομίζω') continue
        // =======================================================================================================
        // здесь есть случай, когда нужно пересчитать lead-prefix в зависимости от cdict: παρακρύπτω / παρέκρυπτον ???
        // =======================================================================================================
        cdict.ckeys = cdict.ckeys.filter(ckey=> {
            let ok = true
            // return ok

            if (lead.pref) { // wf with prefs, с тем же стемом, сборная с префиксом здесь, ее не должно быть в lead.aug
                if (!ckey.prefix && ckey.bad) ok = false // должен быть prefix, но его нет
                if (ckey.prefix && ckey.con && (strip(ckey.prefix.pref) !== strip(lead.pref) || ckey.con !== lead.con)) ok = false
                else if (ckey.prefix && !ckey.con && (strip(ckey.prefix.pref) !== strip(lead.pref))) ok = false
                else if (!ckey.prefix && ckey.aug && strip(ckey.aug) !== lead.con) ok = false // ἀναβαίνω ; διαβάλλω
                // log('__ckeys lead pref', cdict.rdict, 'ok:', ok, 'ckey.prefix?.pref', ckey.prefix?.pref, 'lead_pref', lead.pref, 'lead.con', lead.con, 'ckey.con', ckey.con, 'ckey.aug', ckey.aug)
            } else { // целые, без префикса
                if (ckey.prefix) ok = false
                // if (ckey.bad) ok = false // так я все bads убил, не верно
                else if (ckey.aug !== lead.aug) ok = false
                // if (ok) log('________ckeys aug ok:', cdict.rdict, ok, 'ckey.aug', ckey.aug, 'lead_aug', lead.aug)
            }
            // if (ok) log('________ckeys lead aug ', cdict.rdict, 'lead_pref', lead.pref, 'ckey.prefix', ckey.prefix)
            return ok
        })
        if (cdict.ckeys.length) proxies.push(cdict)
    }

    let rproxies = proxies.map(cdict=> cdict.rdict)
    d('_r_proxies:', lead, rproxies)

    // proxies = []
    return proxies
}

function probeForFLS(proxies, fls) {
    let stemdicts = []
    for (let cdict of proxies) {
        // log('____probe', cdict.rdict, 'stem:', cdict.stem, 'fls', fls.length, '_ckeys', cdict.ckeys.length) // , cdict.stypes
        let cfls = []
        if (cdict.name) {
            // log('_N', cdict.rdict)
            for (let flex of fls) {
                if (!flex.name) continue
                // log('_n_flex', flex.stype)
                // if (cdict.rstress != flex.rstress) continue // различить γλῶττα / φάττα - разные ударения
                for (let ckey of cdict.ckeys) {
                    // log('_name_ckey', cdict.rdict) // TODO:
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
            for (let flex of fls) {
                if (!flex.adverb) continue
                let keys = cdict.var?.[flex.stype] //  || nameKey[flex.stype] ??
                if (!keys) continue
                cfls.push(flex)
            }
        } else if (cdict.verb) {
            // log('_V', cdict.rdict)
            for (let flex of fls) {
                if (!flex.verb) continue
                // log('_F', flex.tense)
                // cfls.push(flex)
                for (let ckey of cdict.ckeys) {
                    // log('_ckey.lead', ckey.con, 'flex.lead', flex.con)
                    // if (!flex.con) continue
                    // if (ckey.con && ckey.con !== flex.con) continue
                    // else if (ckey.aug && ckey.aug !== flex.aug) continue
                    // else if (!!ckey.con !== !!flex.con) continue
                    // else if (!!ckey.aug !== !!flex.aug) continue

                    // // log('_ckey.con', ckey.con, 'flex.con', flex.con)
                    // // log('_ckey.aug', ckey.aug, 'flex.con', flex.aug)

                    if (ckey.stype != flex.stype) continue
                    if (ckey.tense != flex.tense) continue
                    if (!ckey.keys.includes(flex.key)) continue
                    cfls.push(flex)
                    // log('_F_Verb_OK', cdict.rdict, flex.tense)
                }
            }
        }

        if (!cfls.length) continue
        cdict.cfls = cfls
        stemdicts.push(cdict)

    } // proxy cdict
    return stemdicts
}

function breakForChain(lead, br, fls) {
    let maindicts = filterMainDicts(br)
    if (!maindicts.length) return []
    // log('_maindicts _head:', br.head, '_tail:', br.tail, maindicts.length, lead)

    let proxies = filterProxies(lead, maindicts)

    // log('_a_lead:', lead)
    // log('_a_br:', 'head', br.head, 'tail:', br.tail) // 'compound', compound,
    // log('_a_fls', fls.length)

    // TODO: αἴθων - Αἴθων - оба nouns ; nest неверно считает cstype ; а makeWKT неверно считает tgen
    // RFORM
    // ============= NB: Λυκάων - есть в noun и person. совпадают и rdict и dict, и путаются. Нужен аккурантый person: true
    // =======================================================================================================================
    // παρακρύπτω παρέκρυπτον - закомментировал prefix παρέκ
    // HERE - что делать? maindicts вычисляются уже с использование lead.pref, то есть неверно
    // =======================================================================================================================
    // if (!cdict.ckeys) continue // βάδην

    // ἀμφιβάλλω ; αἱρέω ; STEMS: γλαυξ
    // proxies = proxies.filter(cdict=> cdict.rdict == 'ἀμφιβάλλω') // amfiballo
    // proxies = proxies.filter(cdict=> cdict.name) // aireo
    // proxies = proxies.filter(cdict=> cdict.stem == 'βαιν')

    if (!proxies.length) return []
    // let rproxies = proxies.map(cdict=> cdict.rdict)
    // log('_r_proxies:', br.head, lead, rproxies)


    let stemdicts = probeForFLS(proxies, fls)
    if (!stemdicts.length) return []
    let rstemdicts = stemdicts.map(cdict=> cdict.rdict)

    // log('__________________lead', lead, rstemdicts) // SHOW

    let brchains = []
    let dictgroups = _.groupBy(stemdicts, 'dict')  // общий stem, term - разные cdict.dict, verb/name, -> и chains ; noun / adj - вместе

    for (let dict in dictgroups) { // не может быть один dict, и разные name / verb
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

        // cleanChain(probeFLS)
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
        delete cdict.keys
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
        delete cdict.keys
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
    h('lead', lead)
    h('probe.pdict', probe.rdict, '_stem:', probe.stem)
    // если cdict уже имеет префикс, то это полная форма, с коротким стемом
    // а может быть, что noun имеет prefix, а adjective или verb - нет? Кажется, может. И что будет? Это нужно проверять при заливке Nest
    let pps = lead.ps || []
    for (let ppref of pps) {
        let pprefseg = {seg: ppref, dict: ppref, prepref: true}
        scheme.push(pprefseg)
    }
    if (lead.pref) {
        // log('_______________________scheme', probe.rdict, 'probe.prefix', !!probe.prefix, lead)
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
        // log('_______________________AUG', lead, _.keys(probe))
        let aug = lead.aug
        if (aug) scheme.push({seg: aug, dict: aug, aug: true})
        scheme.push({seg: probe.stem, dict: probe.dict, stem: true})
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

function parseHeadTail(stub, term) {
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

function parsePrefSeg(pcwf) {
    let prefraw = parsePrefix(pcwf)
    if (!prefraw) return // {pref: '', con: '', tail: ''}

    let pparts = prefraw.split('-')
    let psize = pparts.length

    let psegs = []
    let pref = pparts.join('')
    while (pparts.length) {
        // log('__p_ref', pref)
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
