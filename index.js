const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, aug2vow, stresses, checkOddStress } from './lib/utils.js'
import { createDBs, getFlexes, getDicts, getNests } from './lib/remote.js'
import { enclitic } from './lib/enclitic.js'
import { prettyIndecl, prettyName, prettyVerb } from './lib/utils.js'
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

let dag = {}

log('_ANTHRAX START')
//  ἵνα πᾶς ὁ πιστεύ­ων ἐν αὐτῷ ἔχῃ ζωὴν αἰώνιον

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> второй запрос к словарям по cdict.dict - за trns
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> восстановить prefdoc - чтобы показать по клику
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> scheme prefdocs / stems
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> // добавить morphs - и схему forms
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> // убрать vars, probe
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> убрать лишнее из cdicts и rels
// plus - сохранять examples

// οἶδα - oida

// prefix:
// ἀπογραφή
// false prefix: ἡμέραι

// indecls: πρίν
// ψευδο - убрать из префиксов!
// ἐπεξήγησις
// πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
// εὐχαριστία,
// προσαναμιμνήσκω, προσδιαιρέω
// παραγγέλλω = vow
// ἀμφίβραχυς - adj
// προσδιαγράφω, προσδιαφορέω, προσεπεισφορέω
// note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза.
// συγκαθαιρέω - καθαιρέω - αἱρέω <==
// προσεπεισφορέω
// εὐδαιμονία; εὐτυχία
// ἀγάπη

// compound: χρονοκρατέω - χρόνος; κρατέω

// ========== еще проверить
// ἦρ; ἡρωίς; τηρός; ἄγγελος; τρωγλοδύτης; γόνυ; συνίημι; γέγωνα; δείδω; κατανεύω; ὁράω; καλός;
// ἶλιγξ; δοῦλος; βοηθός; αἰθαλίων; ἀδελφός; κακός; ἀντίπαις; ἀοιδός; ἅγιος; πολύς; ἀγαθός; αἶρα; καθαίρω; ἀγαθοεργέω; ἁλίσκομαι; ἀγαλλιάω;
// χάσκω; βλέπω; ἀναβλέπω; ἀνήρ; πόρος; γιγνώσκω; ἀναγιγνώσκω; βλέπω; λαμβάνω; αὐλικός; αἴρω


// === BUGS === πάντων - πας нет, а есть π + άντων, где π от глагола, где д.б. aug

// ἐξέρχομαι
// ἀδικέω - odd δικάζω; παραναβαίνω
// проверить ἀνθράκινα, д.б. два результата
// prefix м.б. обманом - καθαίρω, в main-словаре он будет καθαιρ-ω, а в lsj, интересно?
// ἡμέρα

let dbdefaults = ['wkt', 'bbh', 'dvr', 'lsj'] // , 'lsj' , 'bbl'
// let dbdefaults = ['bbl'] // , 'lsj' , 'dvr'

export async function anthrax(wf, dnames) {
    // log('_____________DNAMES', wf, dnames)
    if (!wf) return []

    if (!dnames) dnames = dbdefaults
    dnames.push('nest')

    await createDBs(dnames)

    let chains = []
    let termdicts = await getIndecls(wf)
    // log('_INDS', termdicts.length)
    if (termdicts.length) {
        let termchain = makeTermChain(wf, termdicts)
        chains.push(termchain)
    }

    let dag = await parseDAG(wf)
    if (!dag) return chains
    // log('_DAG', _.keys(dag))
    // ======================== ἀνακύκλωσις
    // pref - есть, а в WKT слово - νακυκλ -без префикса

    // false prefix: ἡμέραι

    let leads = []
    let leadPref = parsePrefSeg(dag.pcwf)
    if (leadPref) leads.push(leadPref)
    // log('___leadPref', leadPref)
    d(leadPref) // '_PREF tail',

    // pref = null
    // ἀνακύκλωσις - pref = null // ==== значит, надо оба варианта, пока в словаре все слова точно не будут обработаны на префиксы - ἀνακύκλησις
    // или просто подождать DVR, LSJ, там есть - κλῆσις

    let leadAug = parseAug(dag.pcwf)
    if (leadAug) leads.push(leadAug)
    // log('____leadAug', leadAug)
    d(leadAug) // '_AUG tail',

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
    await addTrns(chains)

    return chains
}

async function main(dag, lead) {
    let ptail = lead.tail
    let headtails = parseHeadTails(dag, ptail)
    // log('_headtails', ptail, headtails)
    let dictbreaks = await parseDictBreaks(headtails, dag.termflex)
    // log('_dictbreaks', dictbreaks)

    // let d_br_str = dictbreaks.map(br=> ['_head:', br.head, br.term].join(' - '))
    // log('_d_br_str', lead.aug, d_br_str)

    let chains = []
    for (let br of dictbreaks) {
        let fls = dag.termflex[br.term]
        if (!fls) continue
        let brchains = probeForFlex(lead, br, fls)
        chains.push(...brchains)
    }

    return chains
}

function proxyByConnector(con, dicts) {
    let proxies = []
    for (let cdict of dicts) {
        if (con != cdict.aug) continue // соответствие Second Component и BR
    }
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
            // leadPref { pref: 'ἀμφ', con: 'ι', tail: 'βαλλετον' }
            // здесь-ли проверка на аугмент исторического времени?
            // в имперфекте con должен быть сильный, ἀμφιβάλλω - если коннектор 'ι', то имперфект отбросить

        } else if (lead) { // lead.aug can be ''
            // log('____lead aug_', cdict.rdict, 'l_aug', lead.aug, 'c_aug', cdict.aug, lead.aug == cdict.aug, '_prefix', cdict.prefix)
            if (cdict.prefix) continue
            if (lead.aug == cdict.aug) proxies.push(cdict)
            if (!lead.aug && !cdict.aug) proxies.push(cdict)
            cdict.test_cdict_aug = true

            // log('____xxxxxxxxxxxxxxxxxxxxxxxxxxxx_', cdict.rdict, 'l_aug', lead.aug, 'c_aug', cdict.aug, 'proxy', cdict.proxy)
        }
        // log('____xxxxxxxxxxxxxxxxx_', cdict.rdict, '_prefix', cdict.prefix)
        // if (cdict.rdict == 'εἰλύω') log('_C', cdict)
    }
    return proxies
}

function probeForFlex(lead, br, fls) {
    // log('_____________fls', lead, br.head, br.headdicts.length)
    if (br.taildicts.length && !br.headdicts.length) return []
    if (!br.taildicts.length && br.con) return []

    let compound = !!br.taildicts.length && !!br.headdicts.length
    let maindicts = (compound) ? br.taildicts : br.headdicts
    // log('___maindicts', maindicts.length)
    if (!maindicts.length) return []
    let stem = (compound) ? br.tail : br.head

    let mainrdicts = _.uniq(maindicts.map(cdict=> cdict.rdict))
    // log('___br.head', br.head, mainrdicts)
    // log('_br', br.head, br.hsize, 'con', br.con,  '_tail:', br.tail, br.tsize, '_term:', br.term, 'compound', compound)

    let proxies = (compound) ? proxyByConnector(br.con, maindicts) : proxyByLead(lead, maindicts)
    // proxies = proxies.filter(cdict=> cdict.rdict == 'ἀμφιβάλλω') // amfiballo
    if (!proxies.length) return []

    let proxy_rdicts = proxies.map(cdict=> cdict.rdict)
    // log('_p_roxies_rdicts head:', br.head, 'rdicts:', proxy_rdicts)

    let daglead = ''
    if (lead.pref) {
        // log('______________LEAD PREF', cdict.rdict, lead)
        // TODO: тут пока непонятно, flex.aug <-> lead.con
        daglead = lead.con
    } else if (lead && lead.aug) {
        daglead = lead.aug
        // log('_LEAD AUG', lead)
        // log('______________LEAD AUG cdict.rdict:', cdict.rdict, 'cdict.aug', cdict.aug, 'lead', lead.aug, cdict.aug == lead.aug)
    }

    // log('_lead', lead)
    // log('_daglead', daglead)

    fls = fls.filter(flex=> {
        if (daglead) return flex.lead == daglead
        else return !flex.lead
    })

    let nfls = fls.filter(flex=> flex.name)
    let advfls = fls.filter(flex=> flex.adverb)
    let vfls = fls.filter(flex=> flex.verb)
    // let pfls = fls.filter(flex=> flex.part)

    if (!fls.length) return []
    // log('_fls', fls.length)
    // TODO: αἴθων - Αἴθων - оба nouns ; nest неверно считает cstype ; а makeWKT неверно считает tgen

    let brchains = []
    let stemdicts = []

    for (let cdict of proxies) {
        if (cdict.person) continue // TODO::
        // if (cdict.rdict != 'γλῶττα') continue // RFORM
        // if (cdict.stem != 'γλαυξ') continue
        // ============= NB: Λυκάων - есть в noun и person. совпадают и rdict и dict, и путаются. Нужен аккурантый person: true
        // log('_cdict', cdict)


        if (!cdict.ckeys) continue // βάδην
        let ckeys = cdict.ckeys

        if (daglead) ckeys = cdict.ckeys.filter(ckey=> ckey.lead == daglead || !ckey.lead) // или нет lead - простые глаголы + внешний префикс - ἀνακοσμέω - κοσμέω
        // else ckeys = cdict.ckeys.filter(ckey=> !ckey.lead)

        if (!ckeys.length) continue

        // log('____probe', cdict.rdict, cdict.stem, cdict.pos, 'fls', fls.length) // , cdict.stypes

        // participles - есть stype3: 'άουσα-άον', нет keys
        // log('_CKEYS', cdict.rdict, cdict.rstress)

        let cfls = []
        if (cdict.name) {
            for (let flex of nfls) {
                if (cdict.rstress != flex.rstress) continue // различить γλῶττα / φάττα - разные ударения
                // log('_rstress', cdict.rdict, cdict.rstress, flex.rstress, flex.term)
                // log('_f', cdict.rdict, cdict.stypes, flex.stype, flex.term, '_key', flex.key)

                for (let ckey of ckeys) {
                    // if (!ckey.keys) log('_no_ckeys', cdict.rdict) // TODO:
                    if (ckey.stype != flex.stype) continue
                    if (ckey.gend != flex.gend) continue
                    if (!ckey.keys.includes(flex.key)) continue
                    cfls.push(flex)
                    // log('_F_Name_OK', flex.diarform, flex.lead)
                }

                // if (flex.adverb || ckeys.includes(flex.key)) cfls.push(flex)
            }
            for (let flex of advfls) {
                let keys = cdict.var?.[flex.stype] //  || nameKey[flex.stype] ??
                if (!keys) continue
                cfls.push(flex)
            }
        } else if (cdict.verb) {
            for (let flex of vfls) {
                // log('_F', flex.tense)
                // cfls.push(flex)
                for (let ckey of ckeys) {
                    if (!ckey.keys) log('_no_ckeys', cdict.rdict) // TODO:
                    // if (ckey.lead != flex.lead) continue
                    if (ckey.stype != flex.stype) continue
                    if (ckey.tense != flex.tense) continue
                    if (ckey.keys.includes(flex.key)) cfls.push(flex)
                    // cfls.push(flex)
                    // if (ckey.keys.includes(flex.key)) log('_F_OK', ckeys.length, cdict.rdict, flex.tense, flex)
                }
            }
        }

        if (!cfls.length) continue
        cdict.cfls = cfls

        // log('probe_ok', cdict.pos, cdict.rdict, cdict.stem,  '_cfls:', cdict.cfls.length)

        stemdicts.push(cdict)
        // let probeFLS = {cdict.dict, cdicts, rels: maindicts, term: br.term}

        // if (compound && br.headdicts.length) {
        //     let hrdicts = br.headdicts.map(cdict=> cdict.rdict)
        //     probeFLS.hrdicts = hrdicts
        //     probeFLS.hdicts = br.headdicts
        //     probeFLS.head = br.head
        //     if (br.con) probeFLS.con = br.con
        // }
        // brchains.push(probeFLS) // COMPOUND
    } // proxy cdict

    if (!stemdicts.length) return []

    let dictgroups = _.groupBy(stemdicts, 'dict')  // общий stem, term - разные cdict.dict, verb/name, -> и chains ; noun / adj - вместе

    for (let dict in dictgroups) {
        let cdicts = dictgroups[dict]

        let probe = cdicts[0] // определить pos и scheme  // ἀντιδιαβάλλω
        if (!probe) log('_NO_P_ROBE_DICT___!!!', dict, maindicts.length, cdicts)

        let probeFLS = {dict, cdicts, rels: maindicts, term: br.term}
        if (probe.verb) probeFLS.verb = true
        else probeFLS.name = true

        let scheme = parseScheme(lead, probe, br.term)
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

function makeVars(cdict) {
    let vars = []
    for (let stype of cdict.stypes) {
        if (stype == 'ω') stype = 'ω-ω'
        // if (cdict.rdict == 'ἀντιβάλλω') log('_stype', stype) // ἀβίοτος

        for (let gend in nameKey[stype]) {
            let keys = nameKey[stype][gend]
            let variant = {stype, gend, keys}
            vars.push(variant)
        }

        for (let tense in verbKey[stype]) {
            let keys = verbKey[stype][tense]
            let variant = {stype, tense, keys}
            // log('_make vars tense', cdict.rdict, '_tense', tense, keys)
            vars.push(variant)
        }
        // log('_make vars', cdict.rdict, '_stype', stype, vars.length)
    }
    // log('_MAKE VARS', cdict.rdict, vars)
    return vars
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


function parseScheme(lead, probe, term) {
    let scheme = []
    let schemobj = []
    let prefix, aug, stem
    // если cdict уже имеет префикс, то это полная форма, с коротким стемом
    // а может быть, что noun имеет prefix, а adjective или verb - нет? Кажется, может. И что будет? Это нужно проверять при заливке Nest

    if (lead.pref) {
        if (probe.prefix) {
            stem = [probe.prefix.pref, probe.prefix.con, probe.stem].join('')
            // scheme.push(stem)
            scheme.push({seg: stem, dict: probe.dict, stem: true})
            // schemobj.stem = stem
        } else {
            let pref = [lead.pref, lead.con].join('')
            // scheme.push(pref)
            // scheme.push(probe.stem)
            scheme.push({seg: pref, dict: lead.pref, pref: true})
            scheme.push({seg: probe.stem, dict: probe.dict, stem: true})
            // schemobj.pref = pref
            // schemobj.stem = probe.stem
        }
    } else if (lead) {
        if (probe.aug) stem = [probe.aug, probe.stem].join('')
        else stem = probe.stem
        // scheme.push(stem)
        scheme.push({seg: stem, dict: probe.dict, stem: true})
        schemobj.stem = stem
    } else {
        log('_NO_LEAD', lead)
        scheme.push('__kukuku_no_lead_убрать') // TODO:
    }
    scheme.push({seg: term, dict: term, term: true})
    // schemobj.term = term

    // brchain.scheme = scheme
    // brchain.schemobj = schemobj
    // brchain.schemestr = scheme.join('-')

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
        // if (lead.typeaug) ht.typeaug = true, ht.aug = lead.aug
        // else if (lead.typepref) ht.typepref = true, ht.prefix = lead.prefix, ht.con = lead.con
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
    let pref_ = parsePrefix(pcwf)
    if (!pref_) return // {pref: '', con: '', tail: ''}
    let pref = pref_.replace(/-/g, '')
    let repref = new RegExp('^' + pref)
    let atail = pcwf.replace(repref, '')
    let { con, tail } = removeVowelBeg(atail)
    return {pref, con, tail}
}

// ====================================


function parsePrefix(pcwf) {
    let prefstr = '', re
    for (let pref of preflist) {
      re = new RegExp('^' + pref.replace(/-/g, ''))
        if (!re.test(pcwf)) continue
        if (prefstr.length < pref.length) prefstr = pref
    }
    return prefstr
}

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

async function getIndecls(wf) {
    let cwf = oxia(comb(wf))
    // log('_______________________________________________WF', wf, cwf)
    let keys = [cwf]
    let termcdicts = await getDicts(keys)
    // log('_______________________________________________WF', wf, termcdicts)
    termcdicts = termcdicts.filter(dict=> dict.indecl || dict.irreg)
    return termcdicts
}

function makeTermChain(wf, termcdicts) {
    let termchain = {dict: wf, indecl: true}
    let cdicts = []
    let rdictgroups = _.groupBy(termcdicts, 'rdict') // indecl vs irreg на самом деле
    for (let rdict in rdictgroups) {
        let gcdicts = rdictgroups[rdict]
        let wkt = gcdicts.find(cdict=> cdict.dname == 'wkt') || gcdicts[0]
        if (!wkt) continue
        wkt.trn = {}
        for (let dict of gcdicts) {
            wkt.trn[dict.dname] = dict.trns
        }
        delete wkt.trns
        cdicts.push(wkt)
    }
    termchain.cdicts = cdicts
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
