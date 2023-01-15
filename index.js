const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, getStress, parseAug, aug2vow, aspirations } from './lib/utils.js'
import { getTerms, getTermsNew, getFlexes, getDicts, getPrefs } from './lib/remote.js'
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

export async function anthrax(wf) {
    let chains = []
    let cwf = oxia(comb(wf).toLowerCase())
    // let termcdicts = await getTerms(cwf)
    // log('_TD', termcdicts)
    let termcdicts = await getTermsNew(cwf)
    // log('_TERMS', termcdicts)
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

    // ἀδικέω - odd δικάζω
    // проверить ἀνθράκινα, д.б. два результата
    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?
    let prefsegs = await makePrefSegs(dag) || []
    // log('_PREF_SEGS', prefsegs)

    let chains = []
    let breaks = []

    for await (let prefseg of prefsegs) {
        dag.prefseg = prefseg
        let ptail = plain(prefseg.tail)
        breaks = await cleanBreaks(dag, ptail)
        // в цикле по префиксам не может быть cdicts с префиксами, они вычисляются в augs:
        // log('_DAG:', dag)
        // log('_prefseg:', prefseg)
        // log('_ptail:', ptail, breaks)
        let prefchains = await eachBreak(dag, breaks)
        // log('_prefchains:', prefchains.length)
        // это временно, до компаундов. Потом makePrefSegs будет создавать сразу prefSegs:
        delete prefseg.tail

        prefchains.forEach(chain=> {
            let mainseg = chain.find(seg=> seg.mainseg)
            if (!mainseg) return
            let cdict = mainseg.cdicts[0]

            // chains.push(chain)
            if (cdict.prefix) cdict.prefix = cdict.prefix.replace(/-/g, '')
            // log('_xxxxxxxxxxxxxxx', cdict.prefix, prefseg.seg)
            if (cdict.prefix && cdict.prefix == prefseg.seg) {
                chains.push(chain)
            } if (!cdict.prefix) {
                chain.unshift(prefseg)
                chains.push(chain)
            }
        })
        delete dag.prefseg
    }

    let aug = parseAug(dag.pcwf)
    if (aug) {
        dag.aug = aug
        let re = new RegExp('^' + dag.aug)
        dag.pcwf = dag.pcwf.replace(re, '')
        let augseg = {seg: dag.aug, aug: true}
        dag.augseg = augseg
    }

    breaks = await cleanBreaks(dag, dag.pcwf)
    let augchains = await eachBreak(dag, breaks)

    augchains.forEach(chain=> {
        let mainseg = chain.find(seg=> seg.mainseg)
        if (!mainseg) return
        let cdict = mainseg.cdicts[0]
        if (cdict.prefix) return
        if (dag.augseg) chain.unshift(dag.augseg)
        chains.push(chain)
    })

    return chains
}

async function eachBreak(dag, breaks) {
    let chains = []
    // let regdicts = await getRegVerbs(breaks)
    // let breakids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
    // log('_break-ids', breakids)

    for (let br of breaks) {
        let headdicts = br.headdicts
        // let head_rdicts_list = headdicts.map(dict=> dict.rdict)
        // log('_head_rdicts_list', head_rdicts_list)
        let taildicts = br.taildicts
        let pfls = br.fls.docs

        if (taildicts) {

        } else {
            let dictgroups = _.groupBy(headdicts, 'dict') // cdicts из разных словарей
            for (let dict in dictgroups) {
                let cdicts = dictgroups[dict]
                // let cdicts_list = cdicts.map(dict=> dict.rdict)
                // log('_cdicts_list', cdicts_list)
                let probeChains = eachProbechain(dag, br, cdicts, headdicts)
                chains.push(...probeChains)
            }
        }

    }
    // return []
    return chains
}

function eachProbechain(dag, br, cdicts, cognates) {
    let probeChains = []
    let probes = cdicts.filter(dict=> dict.dname == 'wkt')  // || [grdicts[0]] // ἅγιος - noun / adjective

    for (let probe of probes) {
        let cfls = []
        let flsid = br.fls._id
        // let pfls = br.fls.docs.filter(flex=> flex.type == probe.type)
        // let pfls = br.fls.docs.filter(flex=> flex.type == probe.type && flex.stress == dag.stress && flex.stressidx == dag.stressidx)
        let pfls = br.fls.docs.filter(flex=> flex.type == probe.type && flex.stressidx == dag.stressidx)
        // log('_PFLS', probe.rdict, probe.stem, pfls.length)
        // log('_DAG', probe.rdict, dag.stress, dag.stressidx)
        if (!pfls.length) continue

        // if (probe.verb) cfls.push(...filterProbePart(probe, pfls))
        let conn = dag.prefseg?.conn || dag.augseg?.seg
        if (probe.verb) cfls.push(...filterProbeVerb(probe, pfls, conn))
        else cfls = filterProbeName(probe, pfls)
        // log('_PROBE', probe.rdict, pfls.length, cfls.length, 'DAG', dag.stress, dag.stressidx)
        if (!cfls.length) continue
        if (!probe.trns) probe.trns = ['non regular verb']
        // log('_PROBE-CFLS', probe.rdict, probe.stem, cfls.length)

        let chain = makeChain(probe, cdicts, cfls, cognates, flsid)
        probeChains.push(chain)
    }
    return probeChains
}

// function makeChain(br, probe, cdicts, fls, mainseg, headdicts, regdicts, cognates) {
function makeChain(probe, cdicts, fls, cognates, flsid) {
    let chain = []
    let flsseg = {seg: flsid, fls}
    chain.push(flsseg)

    let rcogns = _.uniq(cognates.map(dict=> dict.rdict)).join(',')
    let tailseg = {seg: probe.stem, cdicts: [probe], rdict: probe.rdict, cognates, rcogns, prefix: probe.prefix, mainseg: true}
    if (probe.verb) tailseg.verb = true
    else if (probe.name) tailseg.name = true
    // log('_T', tailseg)
    // если нужен regdict для одного из cdicts, перенести trns
    // let regdict = regdicts.find(regdict=> regdict.dict == cdict.dict)
    // if (regdict) tailseg.regdict = regdict
    chain.unshift(tailseg)

    // if (br.head && br.tail) {
    //     let connseg = {seg: br.conn, conn: true}
    //     if (br.conn) chain.unshift(connseg)
    //     if (headdicts.length) {
    //         let rcogns = headdicts.map(dict=> dict.rdict).join(',')
    //         let headseg = {seg: br.head, cdicts: headdicts, cognates: headdicts, rcogns, head: true}
    //         chain.unshift(headseg)
    //     }
    // }

    return chain
}

function filterProbePart(dict, pfls) {
    // log('_filter-Dict-Part =====', dict.rdict, dict.stem, dict.type, dict.dname)
    if (!dict.verb || !dict.reg) return []
    let cfls = []
    let dkeys = dict.keys ? dict.keys : vkeys[dict.type] ? vkeys[dict.type] : []
    // log('_Part keys', dict.rdict) // , dkeys
    for (let flex of pfls) {
        // if (!flex) log('_________________NO FLEX', dict.rdict)
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

function filterProbeVerb(dict, pfls, conn) {
    if (!dict.verb) return []
    if (!dict.keys) dict.reg = true
    let dkeys = dict.keys ? dict.keys : vkeys[dict.type] ? vkeys[dict.type] : []
    let cfls = []
    // log('_D-verb', dict.rdict, dict.prefix, dict.stem, dict.type, pfls.length, dict.keys['pres.act.ind']) // , pfls.length

    for (let flex of pfls) {
        if (!!dict.reg != !!flex.reg) continue
        if (dict.type != flex.type) continue
        if (dict.syllables != flex.syllables) continue
        if (flex.part) continue

        // почему if ?
        if (dict.vtypes[flex.stype]) {
            if (flex.mood == 'ind' && dict.vtypes[flex.stype].ind != conn) continue
            else if (flex.mood != 'ind' && dict.vtypes[flex.stype].soi != conn) continue
        }

        // log('_F', dict.rdict, dict.stem, dict.type, '_vtypes', flex.stype,  dict.vtypes[flex.stype], 'CONN:', conn, flex.numper, flex.mood)
        // log('_F', flex)
        let fkeys = dkeys[flex.tense]
        if (!fkeys) continue
        if (!fkeys.includes(flex.key)) continue

        // log('_F_OK', dict.rdict, dict.stem, dict.type, '_vtypes', flex.stype,  dict.vtypes[flex.stype], 'CONN:', conn, flex.numper, flex.tense)
        cfls.push(flex)
    }
    // log('_CFLS', cfls.length)
    return cfls
}

function filterProbeName(dict, pfls) {
    f('_filter-D-Name =====', dict.rdict, dict.stem, dict.type, dict.dname) // , dict.keys
    // let dialectnames = _.keys(dict).filter(dname=> !notdialectnames.includes(dname))
    // f('_dialectnames', dialectnames)
    if (!dict.keys) {
        // log('_NO DICT.KEYS', dict)
        // это пока что dvr и прочие словари
        return []
    }

    let cfls = []
    for (let flex of pfls) {
        if (!flex.name) continue
        if (dict.type != flex.type) continue
        let key = dict.keys.find(dkey=>
            dkey.dialect == flex.dialect  &&
                dkey.declension == flex.declension &&
                dkey.stype == flex.stype
                // dkey[flex.gend] == flex.key
        )
        if (flex.adv) key = dict.keys.find(dkey=> dkey.adv == flex.key)
        else key = dict.keys.find(dkey=> dkey[flex.gend] == flex.key)
        if (!key) continue
        f('_filter-F', dict.rdict, dict.syllables, flex)
        cfls.push(flex)
    }
    return cfls
}

function makeChain_old(br, probe, cdicts, fls) {
    let headdicts = br.headdicts
    let head_rdicts_list = headdicts.map(dict=> dict.rdict)
    f('_head_rdicts_list', head_rdicts_list)
    let taildicts = br.taildicts
    let cognates = (br.tail) ? taildicts : headdicts            // cognates - совсем грязные
    let mainseg = (br.tail) ? (br.tail) : (br.head)

    let chain = []
    let flsseg = {seg: br.fls._id, fls}
    chain.push(flsseg)

    if (mainseg.length < 2) cognates = []
    let rcogns = _.uniq(cognates.map(dict=> dict.rdict)).join(',')
    // let tailseg = {seg: mainseg, cdicts, rdict: probe.rdict, cognates, rcogns, mainseg: true}
    let tailseg = {seg: mainseg, cdicts: [probe], rdict: probe.rdict, cognates, rcogns, mainseg: true}
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

// compound - προσαναβαίνω; ἀντιπαραγράφω; ἀποδείκνυμι; ἀναβλέπω
async function makePrefSegs(dag)  {
    let prefraw = parsePrefix(dag.pcwf)
    if (!prefraw) return
    let prefs = prefraw.split('-')
    if (prefs.join('') == dag.pcwf) return []
    let segs = []
    let oprefs = []
    prefs.forEach(rawpref=> {
        let o = {rawpref, pref: rawpref, conn: ''}
        let conn = ''
        if (rawpref == 'δι') o.conn = ''
        else if (o.pref.endsWith('ι')) {
            o.conn = 'ι'
            o.pref = o.pref.replace(/ι$/, '')
        }
        let prefdoc = prefdocs.find(prefdoc=> strip(prefdoc.dict) == strip(o.pref))
        if (!prefdoc) {
            log('_NO PREF_DOC', rawpref, dag.rawwf)
            throw new Error()
        }
        o.docs = [prefdoc]

        let last = _.last(oprefs)
        if (last) {
            o.pref = last.rawpref + o.pref
            o.rawpref = o.pref
            o.docs = last.docs.concat(o.docs)
        }
        oprefs.push(o)
        // log('_XXX_SEG', o)
        let rerawpref = new RegExp('^' + o.rawpref)
        let tail = dag.cwf.replace(rerawpref, '')
        if (tail == dag.cwf) tail = dag.pcwf.replace(rerawpref, '')
        // log('_TAIL', o.rawpref, dag.pcwf, tail)
        let shorttail = removeVowelBeg(tail)
        let retail = new RegExp(shorttail + '$')
        let tailconn = tail.replace(retail, '')
        let seg = {seg: o.pref, conn: o.conn, tail: shorttail, docs: o.docs, pref: true}
        if (tailconn) seg.conn = tailconn
        segs.push(seg)
    })
    return segs
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
    // dicts = dicts.filter(dict=> !dict.prefix)
    let rdicts = dicts.map(dict=> dict.rdict)
    // log('_break all rdicts:', rdicts, rdicts.length)

    let prefcon
    if (dag.prefsegs) {
        let conns = dag.prefsegs.filter(seg=> seg.conn)
        prefcon = _.last(conns)
    }

    let vow = (prefcon) ? prefcon.seg : dag.aug ? dag.aug : ''
    f('_VOW-connector:', vow)

    breaks.forEach(br=> {
        // log('_BR', br.head, br.conn, br.tail, 'fls', br.fls._id)
        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        // if (br.head == 'γοραζ') log('_XXXX', br.head, headdicts.length)
        let rdicts = headdicts.map(dict=> dict.rdict)
        // log('_HEAD-RDICTS', br.head, rdicts)
        // теперь aug в диалектах
        // headdicts = headdicts.filter(dict=> vowDictMapping(vow, dict))

        rdicts = headdicts.map(dict=> dict.rdict)
        // log('_HEAD-RDICTS_2', rdicts)
        if (headdicts.length) br.headdicts = headdicts

        let taildicts = dicts.filter(dict=> dict.stem == br.tail)

        taildicts = taildicts.filter(dict=> dict.stem.length > 2) // очень много лишних, маловероятных схем, ex: γαλ-α-ξ-ίου
        // taildicts = taildicts.filter(dict=> !dict.pos) // спец.формы

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

async function findDicts(breaks) {
    let headkeys = _.uniq(breaks.map(br=> br.head))
    let tailkeys = _.uniq(breaks.map(br=> br.tail))
    let keys = _.compact(headkeys.concat(tailkeys))
    // keys = ['δεικν']
    // log('_findDicts', keys)
    let dicts = await getDicts(keys)
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
