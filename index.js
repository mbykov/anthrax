const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, parseAug, aug2vow, aspirations } from './lib/utils.js'
import { getTerms, getTermsNew, getFlexes, getDicts, getPrefs } from './lib/remote.js'
import Debug from 'debug'

import { vkeys } from '../Dicts/WKT/wkt/wkt-keys/keys-verb.js'
import { nkeys } from '../Dicts/WKT/wkt/wkt-keys/keys-name.js'
import { akeys } from '../Dicts/WKT/wkt/wkt-keys/keys-adj.js'
import { pKeys } from '../Dicts/WKT/wkt/wkt-keys/keys-part.js'

const d = Debug('app')
const p = Debug('pref')
const h = Debug('whole')

let dag = {}

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

export async function anthrax(wf) {
    let chains = []
    let cwf = oxia(comb(wf).toLowerCase())
    // let termcdicts = await getTerms(cwf)
    // log('_TD', termcdicts)
    let termcdicts = await getTermsNew(cwf)
    // log('_TD NEW', termcdictsnew)
    if (termcdicts.length) {
        let termchain =  [{seg: cwf, cdicts: termcdicts, indecl: true}]
        chains.push(termchain)
        return chains
    }

    let dictchains = await anthraxChains(wf)
    // если есть короткий chain, то отбросить те chains, где sc имеет стемы с длиной = 1 // TODO = аккуратно сделать
    // let bestchain = chains.find(chain=> chain.slice(-2,-1)[0].seg.length > 1)        // ломается на ἀγαπητός

    chains.push(...dictchains)
    return chains
}

async function anthraxChains(wf) {
    dag = new Map();
    dag.cwf = comb(wf)
    let flakes = scrape(dag.cwf).reverse()

    if (!flakes.length) return
    dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)
    d('_flakes_tails', tails)

    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    d('_pcwf', dag.pcwf)

    // ἀδικέω - odd δικάζω
    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?
    let prefsegs = await makePrefSegs(dag)
    dag.prefsegs = prefsegs
    // dag.prefsegs = ''

    let chains = []
    let breaks = []
    if (dag.prefsegs) {
        breaks = await cleanBreaks(dag, dag.pref_pcwf)
        p('_prefsegs', dag.prefsegs, 'pcwf', dag.pcwf, dag.pref_pcwf)
        let prefchains = await eachBreak(dag, breaks)
        chains.push(...prefchains)
    }
    // log('_CH', chains.length)
    // log('_DAG', dag)

    if (!breaks.length || !chains.length) {
        dag.prefsegs = ''
        breaks = []
        let aug = parseAug(dag.pcwf)
        if (aug) {
            dag.aug = aug
            let re = new RegExp('^' + dag.aug)
            dag.pcwf = dag.pcwf.replace(re, '')
            let augseg = {seg: dag.aug, aug: true}
            dag.prefsegs = [augseg]
        }
        breaks = await cleanBreaks(dag, dag.pcwf)
        // log('_B', breaks.length)
        chains = await eachBreak(dag, breaks)
    }

    // log('_XXXX', chains.length)

    // whole compound
    if (dag.prefsegs) {
        // log('_X_', dag.prefsegs.length, '_CH', chains.length)
        let whcomps = []
        for await (let chain of chains) {
            chain.unshift(...dag.prefsegs)
            whcomps = await wholeCompounds(chain)
            // log('_X_WH', whcomps.length)
        }
        chains.unshift(...whcomps)
    }
    return chains
}

async function eachBreak(dag, breaks) {
    let chains = []
    let regdicts = await getRegVerbs(breaks)
    let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
    d('_breaks-ids', breaksids)

    for (let br of breaks) {
        let headdicts = br.headdicts
        let headdictslist = headdicts.map(dict=> dict.rdict)
        let taildicts = br.taildicts
        let cognates = (br.tail) ? taildicts : headdicts            // cognates - совсем грязные
        let mainseg = (br.tail) ? (br.tail) : (br.head)
        let pfls = br.fls.docs

        // if (br.tail != 'ποι') continue
        // log('\n_==AUG BR==', 'head:', br.head, 'br.conn:', br.conn, 'tail:', br.tail, 'fls:', br.fls._id, '_mainseg:', mainseg, cognates.length)
        // p('_PDICT_FILTER_cogns', cognates.map(dict=> dict.rdict))

        cognates = cognates.filter(dict=> {
            // if (dict.dname == 'wkt') return false
            return true
        })
        // log('_cognates', cognates)

        let dictgroups = _.groupBy(cognates, 'dict')
        // ==== группировать не по dict, а по стему? чтобы затем найти wkt - м.б. несколько

        for (let dict in dictgroups) {
            let grdicts = dictgroups[dict]
            // log('_grDicts', dict, grdicts.length)
            let probe = grdicts.find(dict=> dict.dname == 'wkt') || grdicts[0]

            log('_PROBE', dict, probe.dname, probe.stem, probe.type, probe.verb)
            // log('_P-KEYS', probe.keys)

            let cfls = []
            // pfls = pfls.filter(flex=> flex.type == probe.type)

            if (probe.verb) cfls = filterProbePart(probe, pfls)
            if (probe.verb) cfls = filterProbeVerb(probe, pfls)
            else cfls = filterProbeName(probe, pfls)
            if (!cfls.length) continue
            if (!probe.trns) probe.trns = ['non reg verb']
            // log('_PROBE-CFLS', probe.rdict, probe.augs, cfls.length)
            let cogns = cognates //.filter(cdict=> cdict.dict == dict)
            let chain = makeChain(br, probe, grdicts, cfls, mainseg, headdicts, regdicts, cogns)
            chains.push(chain)
        }
    }
    // return []
    return chains
}

function filterProbePart(dict, pfls) {
    // log('_filter-Dict-Part =====', dict.rdict, dict.stem, dict.type, dict.dname)
    let cfls = []
    let xtense, xtype, xstems
    for (let flex of pfls) {
        if (!flex.part) continue
        let partkeys = pKeys[flex.type]?.[flex.tense]?.[flex.gend]
        // log('_PF', flex.term)
        if (!partkeys.includes(flex.terms)) continue
        cfls.push(flex)
        // log('_P-KEYS', partkeys)
    }
    return cfls
}

function filterProbeVerb(dict, pfls) {
    log('_filter-D-Verb =====', dict.rdict, dict.stem, dict.type, dict.dname)
    let dictkey = { type: dict.type, reg: dict.reg }
    dictkey = JSON.stringify(dictkey)
    let keys = dict.keys ? dict.keys : vkeys[dictkey]
    if (!keys) keys = []
    let cfls = []
    if (!dict.trns) dict.trns = [] // неправильная форма глагола

    for (let flex of pfls) {
        if (dict.type != flex.type) continue
        // let flexkey = {type: flex.type, tense: flex.tense, numper: flex.numper}
        // flexkey = JSON.stringify(flexkey)
        let terms = keys[flex.tense]
        if (!terms) continue
        if (terms.includes(flex.key)) cfls.push(flex)
    }
    return cfls
}

function filterProbeVerb_xKeys(dict, pfls) {
    // log('_filter-D-Verb =====', dict.rdict, dict.stem, dict.type, dict.dname)
    let stem = dict.stem.slice(-7)
    let cfls = []
    let xtense, xtype, xstems
    for (let flex of pfls) {
        if (!flex.verb) continue
        // if (flex.tense != 'act.pres.ind') continue
        xtense = xkeys[flex.key]
        if (!xtense) continue
        // log('_Xtense', xtense)
        xtype = xtense[flex.tense]
        if (!xtype) continue
        xstems = xtype[dict.type]
        if (!xstems) continue
        // if (flex.tense == 'act.pres.ind') log('_XSTEMS', dict.rdict, flex.tense, stem3, xstems)
        if (xstems.includes(stem)) cfls.push(flex)
    }
    return cfls
}

// если dict_any, то нужен цикл по всем dict.gens
// или собирать dictkey из type, each_gens, dict.gends и накапливать keys
// а на самом деле нужно считать частоту gens, и оставлять только лучший вариант
// нет, вручную создать typical-gens

function filterProbeName(dict, pfls) {
    // log('_filter-D-Name =====', dict.rdict, dict.stem, dict.type, dict.dname) // , dict.keys
    // log('_filter-D-Name =====', dict)
    let dictkey = { type: dict.type, gens: dict.gens, gends: dict.gends }
    dictkey = JSON.stringify(dictkey)
    // log('_D-key', dictkey)
    let keys = nkeys[dictkey]
    if (!keys && dict.adj) keys = akeys[dictkey]
    if (!keys) return []

    let cfls = []
    for (let flex of pfls) {
        if (dict.type != flex.type) continue
        if (dict.gends && !dict.gends.includes(flex.gend)) continue
        if (dict.gens && !dict.gens.includes(flex.gen)) continue // dvr может иметь gen

        let flexkey = {term: flex.term, type: flex.type, numcase: flex.numcase}
        flexkey = JSON.stringify(flexkey)
        let terms = keys[flexkey]
        if (!terms) continue
        if (terms.includes(flex.key)) cfls.push(flex)
        // log('_FF', flex.numcase)
    }
    return cfls
}

function filterProbeName_xKeys(dict, pfls) {
    // log('_filter-D-Name =====', dict.rdict, dict.stem, dict.type, dict.dname, dict.keys)
    // log('_filter-D-Name =====', dict)
    let keys = (dict.keys) ? dict.keys : nkeys
    let stem = dict.stem.slice(-3)
    let cfls = []
    let xterm, xnumcase, xgend, xstems
    for (let flex of pfls) {
        if (!flex.name) continue
        // log('_f', flex.numcase)
        if (dict.gends && !dict.gends.includes(flex.gend)) continue
        if (dict.gens && !dict.gens.includes(flex.gen)) continue // dvr может иметь gen
        xterm = nkeys[flex.key]
        if (!xterm) continue
        // log('_xterm', xterm)
        xnumcase = xterm[flex.term]
        // log('_xnumcase', _.keys(xnumcase))
        if (!xnumcase) continue
        xgend = xnumcase[flex.numcase]
        if (!xgend) continue
        // log('_xgend', xgend)
        xstems = xgend[flex.gend].sort()
        if (!xstems) continue
        // log('_xstems', stem, xstems)
        if (!xstems.includes(stem)) continue
        // log('_f', flex)
        cfls.push(flex)
    }
    return cfls
}

function filterProbeName_(dict, pfls) {
    // log('_D-Name=====', dict.rdict, dict.stem, dict.type)
    let cfls = []
    for (let flex of pfls) {
        let ok = true
        if (!flex.name) ok = false
        // log('_F=================', flex)
        if (dict.type != flex.type) ok = false
        if (!dict.gens.includes(flex.gen)) ok = false

        // if (dict.keys[flex.gend] != flex.key) ok = false // пока name можно без keys

        // ok = true
        if (ok) cfls.push(flex)
        // if (ok) log('_F_OK=================', flex)
    }
    // log('_D', dict, 'cfls', cfls.length)
    // return []
    return cfls
}

function filterProbeVerb_vkeys(dict, pfls) {
    // log('_D-Verb =====', dict.rdict, dict.stem, dict.type, dict.dname)
    if (!dict.keys) return []
    let cfls = []
    for (let flex of pfls) {
        let ok = true
        if (!flex.verb) continue
        if (dict.type !== flex.type) continue // это нужно, ибо много правильных: ἀθηνιάω
        log('_F=================', flex.type, flex.tense)
        if (!dict.keys[flex.tense]) continue
        if (!dict.keys[flex.tense].includes(flex.key)) ok = false
        // ok = true
        if (ok) cfls.push(flex)
        // if (ok) log('_FVerb=================', dict.rdict, dict.stem, 1, dict.type, dict.augs, dict.dname, 2, flex.type, flex.term)
        // if (ok) log('_FVerb=================', flex)
    }
    return cfls
}


function makeChain(br, probe, cdicts, fls, mainseg, headdicts, regdicts, cognates) {
    let chain = []
    // chain.push(br)
    let flsseg = {seg: br.fls._id, fls}
    chain.push(flsseg)

    let rcogns = cognates.map(dict=> dict.rdict).join(',')
    let tailseg = {seg: mainseg, cdicts, rdict: probe.rdict, cognates, rcogns, mainseg: true}
    if (probe.verb) tailseg.verb = true
    else if (probe.name) tailseg.name = true
    // если нужен regdict для одного из cdicts, перенести trns
    // let regdict = regdicts.find(regdict=> regdict.dict == cdict.dict)
    // if (regdict) tailseg.regdict = regdict
    chain.unshift(tailseg)

    if (br.head && br.tail) {
        let connseg = {seg: br.conn, conn: true}
        if (br.conn) chain.unshift(connseg)
        if (headdicts.length) {
            let rcogns = headdicts.map(dict=> dict.rdict).join(',')
            let headseg = {seg: br.head, cdicts: headdicts, cognates: headdicts, rcogns, head: true}
            chain.unshift(headseg)
        }
    }

    return chain
}

async function getRegVerbs(breaks) {
    let regs = []
    breaks.forEach(br=> {
        let headregs = br.headdicts.filter(dict=> dict.reg)
        regs.push(...headregs)
        if (!br.taildicts) return
        let tailregs = br.taildicts.filter(dict=> dict.reg)
        regs.push(...tailregs)
    })
    let regstems = _.uniq(_.compact(regs.map(dict=> dict.regstem)))
    let regdicts = await getDicts(regstems)
    return regdicts
}

// clean breaks - только те, которые состоят из обнаруженных в словарях stems
async function cleanBreaks(dag, pcwf) {
    let breaks = makeBreaks(pcwf, dag.flexes)
    // log('_BR', breaks)
    let dicts = await findDicts(breaks)
    let rdicts = dicts.map(dict=> dict.rdict)

    let prefcon
    if (dag.prefsegs) {
        let conns = dag.prefsegs.filter(seg=> seg.conn)
        prefcon = _.last(conns)
    }

    let vow = (prefcon) ? prefcon.seg : dag.aug ? dag.aug : ''
    // log('_VOW', vow)

    breaks.forEach(br=> {
        // log('_BR', br.head, br.conn, br.tail, 'fls', br.fls._id)
        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        let rdicts = headdicts.map(dict=> dict.rdict)
        // log('_HEAD-RDICTS', br.head, rdicts)
        headdicts = headdicts.filter(dict=> vowDictMapping(vow, dict))
        headdicts = headdicts.filter(dict=> !dict.pos) // спец.формы

        rdicts = headdicts.map(dict=> dict.rdict)
        // log('_HEAD-RDICTS_2', rdicts)
        if (headdicts.length) br.headdicts = headdicts
        let taildicts = dicts.filter(dict=> dict.stem == br.tail)

        taildicts = taildicts.filter(dict=> dict.stem.length > 2) // очень много лишних, маловероятных схем, ex: γαλ-α-ξ-ίου
        taildicts = taildicts.filter(dict=> !dict.pos) // спец.формы

        taildicts = taildicts.filter(dict=> vowDictMapping(br.conn, dict))
        if (taildicts.length) {
            headdicts = headdicts.filter(dict=> dict.stem.length > 2)
            taildicts = taildicts.filter(dict=> !dict.pos) // спец.формы
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
    let mapping = false
    if (dict.name) {
        if (dict.aug == conn) mapping = true
        else if (!dict.aug && !conn) mapping = true
        else if (!dict.aug && ['υ', 'xxx'].includes(conn))  mapping = true // βαρύτονος
        // else if (!dict.aug && conn) mapping = true // βαρύτονος - или сделать includes, как в verb?
    } else if (dict.verb) {
        if (!dict.aug) dict.aug = ''
        // log('_MAPPING', dict.rdict, 1, conn, 2, dict.aug)
        if (!dict.aug && !conn)  mapping = true
        else if (!dict.aug && ['ο', 'α'].includes(conn))  mapping = true // ἀγαθοποιέω
        else if (strip(dict.aug) == strip(conn))  mapping = true //
        // mapping = true
    }
    return mapping
}

function findConnection(pstr) {
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
            conn = findConnection(tail)
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

async function findDicts(breaks) {
    let headkeys = _.uniq(breaks.map(br=> br.head))
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    let keys = _.compact(headkeys.concat(tailkeys))
    // keys = ['δεικν']
    // log('_findDicts', keys)
    let dicts = await getDicts(keys)
    dag.dictids = _.uniq(dicts.map(ddict=> ddict.stem))
    d('_dag.dictids', dag.dictids)
    return dicts
}

// compound - προσαναβαίνω; ἀντιπαραγράφω; ἀποδείκνυμι
async function makePrefSegs(dag) {
    let prefsegs = []
    let headkeys = _.uniq(dag.flakes.map(flake=> plain(flake.head)))
    let cprefs = await getPrefs(headkeys)
    // log('_find_cprefs_=', cprefs)
    if (!cprefs.length) return
    let max = _.maxBy(cprefs, function(pref) { return pref.term.length; })

    let pcwf = dag.pcwf
    if (!max.prefs) {
        prefsegs = [{seg: max.term, pref: max}]
    } else {
        let prefs = await getPrefs(max.prefs)
        for (let pref of prefs) {
            let re = new RegExp(pref.term)
            pcwf = pcwf.replace(re, "-$&-")
        }
        pcwf = pcwf.replace(/--/g, '-')
        let parts = pcwf.split('-').slice(1, -1)
        let seg
        for (let part of parts) {
            let pref = prefs.find(pref=> pref.term == part)
            if (pref) seg = {seg: pref.term, pref}
            else seg = {seg: part, conn: true}
            if (seg.seg) prefsegs.push(seg)
        }
    }

    // last connector btw prefs & stem
    let re = new RegExp('^' + max.term)
    pcwf = dag.pcwf.replace(re, '')
    let conn = findConnection(pcwf)
    if (conn) {
        re = new RegExp('^' + conn)
        pcwf = pcwf.replace(re, '')
        let connseg = {seg: conn, conn: true} // , aug: true
        prefsegs.push(connseg)
    }
    dag.pref_pcwf = pcwf
    return prefsegs
}

async function wholeCompounds(chain) {
    let whstems = []
    let fromIndex = 0
    let pref_id = 0
    while (pref_id > -1) {
        pref_id = _.findIndex(chain, function(seg) { return seg.pref; }, fromIndex);
        fromIndex += pref_id
        if (fromIndex == 0) fromIndex = 1
        let rsegs = chain.slice(pref_id)
        let whstem = rsegs.map(seg=> {
            if (seg.pref || seg.conn || seg.mainseg) return seg.seg
        })
        whstem = _.compact(whstem).join('')
        h('_whstem___before', whstem)
        let aug = parseAug(whstem)
        h('_aug', aug)
        if (aug) whstem = whstem.replace(aug, '')
        whstems.push(whstem)
    }
    whstems = _.compact(whstems)
    h('_whstems', whstems)
    let cognates = await getDicts(whstems)
    let rcogns = cognates.map(dict=> dict.rdict)
    h('_cognates', rcogns)

    let whchains = []
    let flseg = chain.find(seg=> seg.fls)
    let mainseg = chain.find(seg=> seg.mainseg)
    let probe = mainseg.cdicts[0]

    let dictgroups = _.groupBy(cognates, 'dict')
    // h('_WH DG', dictgroups)
    chain.forEach((seg, idx)=> {
        if (!seg.pref) return
        let pref = seg.pref
        for (let dict in dictgroups) {
            h('_wh dict', dict, pref.term)
            let cdicts = dictgroups[dict]
            let cdict = dictgroups[dict][0]
            if (cdict.type != probe.type) continue
            // let strdict = strip(cdict.dict)
            if (cdict.dict.startsWith(pref.term)) {
                // h('_START WITH', cdict.rdict, pref.term)
                let whchain = [{seg: cdict.stem, cdicts, rdict: cdict.rdict, mainseg: true, cognates, rcogns }, flseg]
                let pdict = plain(cdict.dict)
                let aug = parseAug(pdict)
                if (aug) {
                    let augseg = {seg: aug, conn: true}
                    whchain.unshift(augseg)
                }
                let beforesegs = chain.slice(0, idx)
                if (beforesegs.length) whchain.unshift(...beforesegs)
                whchains.push(whchain)
            }
        }
    })

    return whchains
}
