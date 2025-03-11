const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, stresses, checkOddStress } from './lib/utils.js'
import { getFlexes, getNests, getIndecls } from './lib/remote.js'
// import { enclitic } from './lib/enclitic.js'
import { prettyName, prettyVerb, guessPrefix } from './lib/utils.js'
import Debug from 'debug'

// KEYS
import { nameKey } from '../parse-dicts/WKT/wkt-keys/key-name.js'
import { verbKey } from '../parse-dicts/WKT/wkt-keys/key-verb.js'

import { preflist } from './lib/prefix/preflist.js'
import { prefDocList } from '../prefslist/dst/prefDocList.js'

const dd = Debug('lead')
const pp = Debug('proxy')
const n = Debug('chain')
const ff = Debug('filter')
const c = Debug('compound')
const ss = Debug('scheme')

// let dag = {}
// log('_ANTHRAX START')

// εξαναλισκω ; συγκαθαιρεω ; προκαταλαμβάνω
// {pref: '', con: '', tail: ''}
function parseLeads(pcwf) {
    let leads = []
    let augLead = parseAug(pcwf)
    leads.push(augLead)
    let prefraw = parsePrefix(pcwf)
    if (!prefraw) return leads

    let pref = prefraw.replace(/-/g, '')
    let prefs = prefraw.split(/-/)
    prefs.push(pref)
    let prefLead = {pref, prefs, prefraw}
    let repref = new RegExp('^' + pref)
    let atail = pcwf.replace(repref, '')
    let prefct = removeVowelBeg(atail)
    prefLead.con = prefct.con
    prefLead.tail = prefct.tail
    leads.push(prefLead)
    return leads
}

export async function anthrax(wf) {
    if (!wf) return []
    // log('_ANTHRAX WF', wf)
    // wf = wf.split('?')[0]

    let conts = []
    let dag = await parseDAG(wf)

    // неизменяемые, indecl, включая irregs, уже имеют trns, в отличие от nests
    let testdnames = ['wkt', 'dvr', 'lsj']
    let idicts = await getIndecls(dag.cwf, testdnames)
    // log('_IDICTS_I', idicts)
    if (idicts.length) {
        dag.idicts = idicts.length
    }

    // ======================== ἀνακύκλωσις
    // pref - есть, а в WKT слово - νακυκλ -без префикса
    // false prefix: ἡμέραι
    // // ἀνακύκλωσις - pref = null // ==== значит, надо оба варианта, пока в словаре все слова точно не будут обработаны на префиксы - ἀνακύκλησις

    let leads = parseLeads(dag.pcwf)
    dd('_LEADS', leads)

    for (let lead of leads) {
        // log('_LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLEAD', lead)
        let brconts = await main(dag, lead)
        conts.push(...brconts)
    }

    // BEST: еще раз (?) могут они появиться, если br.head ограничен? Проверить br.tail
    // отбросить короткие стемы ; ἡμέρα ;  τοῦ
    if (conts.length > 1) {
        // conts = conts.filter(cont=> cont.indecl || cont.stem.length > 1)
        if (conts.length > 1) {
            // log('_TOO_MANY_CONTS', wf)
            // throw new Error()
        }
    }

    // TODO: == объединить, когда обнаружу indecl в гнездах
    // TODO: совсем убрать, но зачем группа?
    if (idicts.length) {
        let igroups = _.groupBy(idicts, 'dict')
        let cidicts = []
        for (let dict in igroups) { // str
            let cdict = {dict, trns: []}
            // trns из разных dname
            for (let idict of igroups[dict]) {
                if (!cdict.pos) cdict.pos = idict.pos
                if (!cdict.rdict) cdict.rdict = idict.rdict
                if (!cdict.morphs) cdict.morphs = idict.morphs
                // if (!cdict.fls) cdict.fls = idict.fls
                let trn = {dname: idict.dname, strs: idict.trns}
                cdict.trns.push(trn)
                // log('____idict', idict)
            }
            cidicts.push(cdict)

        }
        cidicts = []
        // log('_c_idicts', cidicts)
        for (let idict of cidicts) {
            let regcont = conts.find(container=> container.cwf == idict.dict)
            if (regcont) {
                // let icdict = {indecl: true, rdict: idict.rdict, cdict: idict, morphs: [], scheme: [], schm: ''}
                regcont.cdicts.push(idict)
            } else {
                // log('_no_nest_container_for_idict', wf, idict)
                if (idict.pos == 'verb' || idict.pos == 'noun' || idict.pos == 'adj' ) idict.pos = 'irreg'
                else idict.pos = 'indecl'
                let icontainer = {indecl: true, cwf: dag.cwf, stem: '', rels: [], morels: [], cdicts: [idict]}
                conts.push(icontainer)
            }
        }
    }

    // return []
    return conts
}

// πολυμαθίη νόον ἔχειν οὐ διδάσκει // polumathih
async function main(dag, lead) {
    let ptail = lead.tail
    let headtails = parseHeadTails(dag, ptail)
    headtails = headtails.filter(ht=> !ht.tail) // only heads, compounds killed // προσκομίζω - προσεκόμιζε // появляется лишний результат
    dd('_headtails', ptail, 'lead_pref', !!lead.pref,  headtails)
    // best - если есть indecls, то только длинные стемы
    if (dag.idicts) headtails = headtails.filter(ht=> ht.head.length > 1)
    let dictbreaks = await parseDictBreaks(headtails, dag.termflex)
    if (!dictbreaks.length) return []
    // log('_real_lead', lead)
    // log('_dictbreaks', dictbreaks)

    let br_strs = dictbreaks.map(br=> ['_head:', br.head, br.term].join(' - '))
    // log('_br_strs', br_strs)

    let brconts = []
    //
    for (let br of dictbreaks) {
        let fls = dag.termflex[br.term]
        // filterFLS ???
        if (!fls) continue
        pp('_================= br.head', br.head, '_hsize', br.hsize, '_fls', fls.length)

        // farrels, head or tail
        let maindicts = mainDicts(br)
        if (!maindicts.length) continue
        // log('_maindicts _head:', br.head, '_tail:', br.tail, maindicts.length, lead)
        let main_rdicts = maindicts.map(cdict=> cdict.rdict)
        pp('_main_rdicts:', br.head, main_rdicts)
        // log('_main_rdicts:', br.head, main_rdicts)

        // == вопрос, что выгоднее - сначала прокси, потом probe-fls, или наоборот?
        let proxies = proxyByLead(lead, maindicts)
        if (!proxies.length) continue
        let proxies_rdicts = proxies.map(cdict=> cdict.rdict)
        pp('__proxies_rdicts:', proxies_rdicts)
        // log('__proxies_rdicts:', br.head, proxies_rdicts, 'lead.pref:', lead.pref)

        let stemdicts = dictByFLS(proxies, fls)
        if (!stemdicts.length) continue

        let rstemdicts = stemdicts.map(cdict=> cdict.rdict)
        pp('__rstemdicts', rstemdicts) // SHOW
        log('__rstemdicts', br.head, rstemdicts) // SHOW

        // continue

        for (let cdict of stemdicts) {
            cdict.morphs = parseMorph(cdict)
            cdict.scheme = parseScheme(lead, cdict, br.term)
            delete cdict.cfls
            delete cdict.ckeys
        }

        stemdicts = _.sortBy(stemdicts, [function(cdict) { return cdict.rdict.length; }]).reverse()

        let rdicts = stemdicts.map(dict=> dict.rdict)

        let rels = []
        let morels = []
        for (let dict of maindicts) {
            if (dict.proxy) rels.push(dict.rdict)
            else morels.push(dict.rdict)
        }

        let container = {cwf: dag.cwf, rdicts, stem: br.head, rels, morels, cdicts: []}
        // let jsons = stemdicts.map(cdict=> JSON.stringify(cdict.scheme))
        // jsons = _.uniq(jsons)
        // container.schemes = jsons.map(json=> JSON.parse(json))
        container.schemes = stemdicts.map(cdict=> cdict.scheme)

        for (let cdict of stemdicts) {
            let schm = cdict.scheme.map(segment=> segment.seg).join('-')
            cdict.schm = schm
            cleanDict(cdict)
            // let odict = {rdict: cdict.rdict, cdict, morphs: cdict.morphs, scheme: cdict.scheme, schm}
            container.cdicts.push(cdict)
        }

        // log('__container', container.cdicts) // SHOW
        // ddd
        brconts.push(container)
    }

    return brconts
}

function mainDicts(br) {
    // log('_____________mainDicts', '_head', br.head, '_con', br.con, br.headdicts.length)
    if (br.taildicts.length && !br.headdicts.length) return []
    if (!br.taildicts.length && br.con) return []

    let compound = !!br.taildicts.length && !!br.headdicts.length
    // if (compound) return []

    let maindicts = (compound) ? br.taildicts : br.headdicts
    // log('___compound', compound, 'lead:', lead)
    // log('___maindicts', maindicts.length)
    if (!maindicts.length) return []
    let stem = (compound) ? br.tail : br.head

    // let main_rdicts = _.uniq(maindicts.map(cdict=> cdict.rdict))
    // d('_main r_dicts br.head', br.head, main_rdicts)
    return maindicts
}

// =======================================================================================================
// здесь есть случай, когда нужно пересчитать lead-prefix в зависимости от cdict: παρακρύπτω / παρέκρυπτον ???
// =======================================================================================================
function proxyByLead(lead, maindicts) {
    let proxies = []
    for (let cdict of maindicts) {
        // if (cdict.stem != 'διοτ') continue
        // if (cdict.rdict != 'Αἰγαῖος') continue // βάρακος // BIG FILTER LEAD

        if (!cdict.ckeys) {
            if (cdict.pos == 'noun') cdict.ckeys = nameKey[cdict.stype]
            else if (cdict.pos == 'adj') cdict.ckeys = nameKey[cdict.stype3]
            else if (cdict.pos == 'verb') cdict.ckeys = nameKey[cdict.stype]
            // log('_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx NO CKEYS BY STYPE ', cdict.rdict, '_pos:', cdict.pos, cdict.stype, nameKey[cdict.stype], '_end')
        }

        // if (!cdict.ckeys) log('_no_ckeys', cdict.rdict)
        if (!cdict.ckeys) continue

        if (cdict.pos != 'verb') {
            if (lead.pref) {
                if (lead.pref == cdict.prefix?.pref) cdict.proxy = true
                else if (!cdict.prefix && !cdict.aug) cdict.proxy = true //
                // if (cdict.proxy) log('_pref', cdict.rdict, cdict.stem, 'l_pref', lead.pref, 'c_pref', cdict.prefix?.pref)
            } else if (cdict.aug === lead.aug) {
                cdict.proxy = true
                // log('_aug', cdict.rdict, cdict.stem)
            }
            if (cdict.proxy) proxies.push(cdict)
            // log('_proxyByLead________:', cdict.proxy, cdict.rdict, cdict.ckeys.length,  '_lead.aug', lead.aug, cdict.pos, 'cdict.aug', cdict.aug)
        } else {
            cdict.ckeys = cdict.ckeys.filter(ckey=> {
                if (cdict.pos != 'verb') return true
                // log('_ckey_prefix', ckey.con, ckey.prefix?.pref, ckey.prefix?.con)
                let ok = true
                // return ok
                if (lead.pref) { // wf with prefs, с тем же стемом, сборная с префиксом здесь, ее не должно быть в lead.aug
                    if (!ckey.prefix && ckey.bad) ok = false // должен быть prefix, но его нет
                    // if (ckey.prefix && ckey.con && (strip(ckey.prefix.pref) !== strip(lead.pref) || ckey.con !== lead.con)) ok = false
                    if (ckey.prefix && ckey.con && (!lead.prefs.includes(strip(ckey.prefix.pref)) || ckey.con !== lead.con)) ok = false // προκαταλαμβάνω
                    else if (ckey.prefix && !ckey.con && (strip(ckey.prefix.pref) !== strip(lead.pref))) ok = false
                    else if (!ckey.prefix && ckey.aug && strip(ckey.aug) !== lead.con) ok = false // ἀναβαίνω ; διαβάλλω
                } else { // целые, без префикса
                    if (ckey.prefix) ok = false

                    // ἁγνότης ; ἰδιότης, nameKey создан по ἁγνότης, ckey.aug=A, а в lead.aug ἰδιότης - I
                    // вопрос, много-ли лишних значений будет, если я уберу здесь проверку по aug? выглядит она очень уродливо, ckey / flex - это же про окончания
                    // ИЛИ: здесь можно не проверять aug, если ckey вычисляемый (найти пример, где сравнение нужно)
                    // может быть, будет нужно в компаундах
                    else if (ckey.aug !== lead.aug) ok = false

                    // if (ok) log('________ckeys aug ok:', cdict.rdict, 'ckey.aug', ckey.aug, 'lead_aug', lead.aug, ckey)
                }
                // if (ok) log('________ckeys lead aug ', cdict.rdict, 'lead_pref', lead.pref, 'ckey.prefix', ckey.prefix)
                return ok
            })
            if (cdict.ckeys.length) proxies.push(cdict), cdict.proxy = true
        }
    }

    let rproxies = proxies.map(cdict=> cdict.rdict)
    pp('_r_proxies:', rproxies)
    // log('_r_proxies:', rproxies)

    // return []
    return proxies
}

function dictByFLS(proxies, fls) {
    let stemdicts = []
    for (let cdict of proxies) {
        ff('____probe', cdict.rdict, 'stem:', cdict.stem, 'fls', fls.length, '_ckeys', cdict.ckeys.length) // , cdict.stypes
        // log('____probe', cdict.name, cdict.rdict, 'stem:', cdict.stem, 'fls', fls.length, '_ckeys', cdict.ckeys.length) // , cdict.stypes
        let cfls = []
        if (cdict.name) {
            // if (cdict.rdict != 'Αἰγαῖος') continue // BIG FILTER FLS
            // log('_N', cdict.rdict, fls.length, cdict.ckeys.length)
            for (let flex of fls) {
                if (!flex.name) continue
                // log('_n_flex', flex.name, flex.stype)
                // if (cdict.rstress != flex.rstress) continue // различить γλῶττα / φάττα - разные ударения
                for (let ckey of cdict.ckeys) {
                    // log('_name_ckey', cdict.rdict) // TODO:
                    // if (!flex.adverb) {
                    //     if (ckey.stype != flex.stype) continue
                    // }
                    if (ckey.gend != flex.gend) continue
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
        } else {
            log('_name or verb', cdict)
            throw new Error()
        }

        if (!cfls.length) continue
        cdict.cfls = cfls
        stemdicts.push(cdict)

    } // proxy cdict
    return stemdicts
}

function cleanDict(cdict) {
        delete cdict.keys
        delete cdict.proxy
        delete cdict.dname
        delete cdict.raw
        delete cdict.compound
        delete cdict.cstype
        delete cdict.astem
}

function parseMorph(cdict) {
    let morphs = []
    if (cdict.name) morphs = prettyName(cdict.cfls)
    else if (cdict.verb) morphs = prettyVerb(cdict.cfls)
    return morphs
}

function parseScheme(lead, cdict, term) {
    let scheme = []
    if (!lead.pref) {
        if (lead.aug) scheme.push({seg: lead.aug, type: 'aug'})
        scheme.push({seg: cdict.stem, type: 'dict', dict: cdict.dict})
        scheme.push({seg: term, type: 'term'})
        ss('_aug_scheme', scheme)
        return scheme
    }
    let prefs = lead.prefraw.split('-').reverse()
    let lastpref = prefs[0] // reverse!
    // ss('____SCHEMES_lead___', lead, '_prefs', prefs, lastpref)
    let pdict = plain(cdict.dict)
    let reterm = new RegExp(term + '$')
    // let stub = cdict.dict.replace(reterm, '')
    // let xxx =_.clone(cdict)
    // xxx.cfls = 'kuku'
    // xxx.ckeys = 'kuku'
    // log('________DDDD_', cdict.dict, cdict.type, term, xxx)
    lead.prefs.pop()
    scheme.push({seg: cdict.stem, type: 'stem', dict: cdict.dict})

    for (let pref of prefs) {
        let repref = new RegExp(pref)
        if (repref.test(pdict)) continue
        if (pref == lastpref && lead.con) scheme.unshift({seg: lead.con, type: 'con'})
        scheme.unshift({seg: pref, type: 'pref'})
    }
    scheme.push({seg: term, type: 'term'})
    ss('_scheme', pdict, scheme)
    // log('_scheme', pdict, scheme)
    return scheme
}

function parseMorphs(cdicts) {
    let morphs = []
    for (let cdict of cdicts) {
        if (cdict.name) morphs = prettyName(cdict.cfls)
        else if (cdict.verb) morphs = prettyVerb(cdict.cfls)
        cdict.morphs = morphs
    }
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

    let dicts = await getNests(psblstems)
    // log('_dicts_psblstems', dicts.length)

    let real_headtails = []
    for (let ht of headtails) {
        let headdicts = dicts.filter(dict=> dict.stem == ht.head)
        let taildicts = dicts.filter(dict=> dict.stem == ht.tail)
        ht.headdicts = headdicts
        ht.taildicts = taildicts
        ht.hsize = headdicts.length
        ht.tsize = taildicts.length
        // пока без second component
        if (ht.hsize) real_headtails.push(ht)
    }
    return real_headtails
}

function parseHeadTail(stub, term) {
    let pairs = []
    let pstub = plain(stub)
    let head = ''
    let tail = pstub
    let con = ''
    let pos = stub.length + 1
    while (pos > 0) {
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
