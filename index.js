const log = console.log

import path  from 'path'
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'

import { scrape, vowels, parseAug, aug2vow } from './lib/utils.js'
import { getTerms, getTermsNew, getFlexes, getDicts, getPrefs } from './lib/remote.js'
import Debug from 'debug'

const d = Debug('dag')
const p = Debug('pref')
const b = Debug('break')

let dag = {}

// terms: πρίν
// ψευδο - убрать из префиксов!
// ἀδικέω - здесь δι не префикс
// αἱρέω,
// συγκαθαιρέω, καθαιρέω - нет в словаре, есть καθαίρω
// ἀντιπαραγράφω, προσαπαγγέλλω, ἐπεξήγησις
// πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
// εὐχαριστία,
// προσαναμιμνήσκω, προσδιαιρέω
// παραγγέλλω = vow
// ἀμφίβραχυς - adj
// προσδιαγράφω, προσδιαφορέω, προσεπεισφορέω
// note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза.
// συγκαθαιρέω - а теперь бред

export async function anthrax(wf) {
    let chains = []
    let cwf = oxia(comb(wf).toLowerCase())
    // let termcdicts = await getTerms(cwf)
    // log('_TD', termcdicts)
    let termcdicts = await getTermsNew(cwf)
    // log('_TD NEW', termcdictsnew)
    // let tchains = termcdicts.map(cdict=> [{seg: cdict.term, cdict, indecl: true}])
    let termchain =  [{seg: cwf, cdicts: termcdicts, indecl: true}]
    if (termcdicts.length) chains.push(termchain)

    let dchains = await anthraxChains(wf)
    if (dchains) chains.push(...dchains)
    // если есть короткий chain, то отбросить те chains, где sc имеет стемы с длиной = 1
    if (chains.length > 1) {
        chains = chains.filter(chain=> chain.slice(-2,-1)[0].seg.length > 1)
        // ломается на ἀγαπητός
    }

    for (let chain of chains) {
        // let prefseg = chain.find(seg=> seg.pref)
        // let mainseg = chain.find(seg=> seg.mainseg)
        // if (!prefseg.cdicts) continue
        // for (let pref of prefseg.cdicts.reverse()) {
        //     // ========================== TODO ====================
        //     let long = ''
        //     let parts = []
        //     parts.push(pref.term)
        //     if (prefseg.conn) parts.push(prefseg.conn)
        //     parts.push(mainseg.rdict)
        //     long = parts.join('')
        //     log('_XXX', pref.term, long)
        // }
    }

    return chains
}

async function anthraxChains(wf) {
    dag = new Map();
    dag.cwf = comb(wf)
    let flakes = scrape(dag.cwf).reverse()

    if (!flakes.length) return
    dag.flakes = flakes
    let tails = flakes.map(flake=> flake.tail)

    dag.flexes = await getFlexes(tails)
    dag.flexids = dag.flexes.map(flex=> flex._id)
    d('_flexids', dag.flexids)
    dag.pcwf = plain(dag.cwf)
    dag.tail = dag.pcwf
    d('_pcwf', dag.pcwf)

    dag.pref = await makePrefSegs(dag)
    // log('_dag.pref', dag.pref)

    let augseg

    if (dag.pref) {
        augseg = dag.pref
    } else {
        dag.aug = parseAug(dag.pcwf)
        let re = new RegExp('^' + dag.aug)
        dag.pcwf = dag.pcwf.replace(re, '')
        dag.connector = false
        augseg = {seg: dag.aug, aug: true}
    }

    // ἀδικέω - odd δικάζω
    // prefix м.б. обманом - καθαίρω, в wkt-словаре он будет καθαιρ-ω, а в lsj, интересно?
    let chains = []

    let {breaks, regdicts} = await cleanBreaks(dag)
    let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
    // log('_breaks-ids', breaksids)

    for (let br of breaks) {
        let headdicts = br.headdicts
        let headdictslist = headdicts.map(dict=> dict.rdict)
        let taildicts = br.taildicts
        let pdicts = (br.tail) ? taildicts : headdicts            // pdicts - совсем грязные
        let mainseg = (br.tail) ? (br.tail) : (br.head)
        let pfls = br.fls.docs
        // log('\n_==AUG BR==', 'head:', br.head, 'br.conn:', br.conn, 'tail:', br.tail, 'fls:', br.fls._id, '_mainseg:', mainseg)

        // остались prefs для cognates:
        pdicts = pdicts.filter(dict=> {
            if (dict.name && dict.aug != dag.aug) return false
            // else if (dict.verb && !dict.augs.includes(aug)) return false
            return true
        })

        let dictgroups = _.groupBy(pdicts, 'dict')

        for (let dict in dictgroups) {
            let grdicts = dictgroups[dict]
            // log('_grDicts', dict, grdicts.length)
            let probe = grdicts.find(dict=> dict.dname == 'wkt') || grdicts[0]
            // log('_PROBE', probe.rdict)
            let cfls = []
            if (probe.verb) cfls = filterProbeVerb(probe, pfls)
            else cfls = filterProbe(probe, pfls)

            if (!cfls.length) continue
            // log('_PROBE-CFLS', dict, cfls.length)

            let chain = makeChain(br, probe, grdicts, cfls, mainseg, headdicts, regdicts)
            chains.push(chain)
        }
    }
    chains.forEach(chain=> {
        if (augseg) chain.unshift(...augseg)
    })

    return chains
}

function filterProbeVerb(dict, pfls) {
    // log('_D=================', dict.rdict, dict.type)
    let cfls = []
    for(let flex of pfls) {
        let ok = true
        // log('_F=================', flex.type, '_D', dict.type)
        if (!flex.verb) ok = false
        if (dict.type !== flex.type) ok = false
        // if (dict.name && flex.name) ok = true
        if (dict.keys && !dict.keys.includes(flex.key)) ok = false
        if (ok) cfls.push(flex)
        // if (ok) log('_F=================', flex)
    }
    // log('_D', dict, 'cfls', cfls.length)
    return cfls
}

function filterProbe(dict, pfls) {
    let cfls = []
    for(let flex of pfls) {
        let ok = false
        if (dict.name && flex.name && dict.type == flex.type && dict.gens.includes(flex.gen)) ok = true
        // if (dict.name && flex.name) ok = true
        if (dict.keys && flex.key && dict.keys[flex.gend] !== flex.key) ok = false
        // if (!flex.key) ok = false
        if (ok) cfls.push(flex)
        // if (ok) log('_F=================', flex)
    }
    // log('_D', dict, 'cfls', cfls.length)
    return cfls
}

function makeChain(br, probe, cdicts, fls, mainseg, headdicts, regdicts) {
    let chains = []
    let chain = []
    let flsseg = {seg: br.fls._id, fls}
    chain.push(flsseg)

    let tailseg = {seg: mainseg, cdicts, rdict: probe.rdict, mainseg: true}
    // если нужен regdict для одного из cdicts, перенести trns
    // let regdict = regdicts.find(regdict=> regdict.dict == cdict.dict)
    // if (regdict) tailseg.regdict = regdict
    chain.unshift(tailseg)

    if (br.head && br.tail) {
        let connseg = {seg: br.conn, conn: true}
        if (br.conn) chain.unshift(connseg)
        if (headdicts.length) {
            let headseg = {seg: br.head, cdicts: headdicts, head: true}
            chain.unshift(headseg)
        }
    }
    return chain
}

// clean breaks - только те, которые состоят из обнаруженных в словарях stems
async function cleanBreaks(dag) {
    let breaks = makeBreaks(dag.pcwf, dag.flexes)
    let dicts = await findDicts(breaks)

    let regkeys = []
    breaks.forEach(br=> {
        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        if (headdicts.length) br.headdicts = headdicts
        let headregs = headdicts.filter(verb=> verb.stem != verb.regstem)
        if (headregs.length) regkeys.push(...headregs)
        let taildicts = dicts.filter(dict=> dict.stem == br.tail)
        if (taildicts.length) br.taildicts = headdicts
        let tailsregs = taildicts.filter(verb=> verb.stem != verb.regstem)
        if (tailsregs.length) regkeys.push(...tailsregs)
    })

    breaks = breaks.filter(br=> {
        let ok = false
        if (br.headdicts && !br.tail) ok = true
        if (br.headdicts && br.taildicts) ok = true
        return ok
    })

    regkeys = _.uniq(_.compact(regkeys.map(dict=> dict.regstem)))
    // regkeys = ['πυνθαν']
    let regdicts = await getDicts(regkeys)
    return {breaks, regdicts}
}

function prettyBeakIDs_(breaks) {
  return breaks.map(br=> {
    let strs = []
    if (br.head) strs.push(br.head)
    if (br.conn) strs.push(br.conn)
    if (br.tail) strs.push(br.tail)
    strs.push(br.fls._id)
    return strs.join('-')
  }) // todo: del
}

// return словарное значение pref.term и коннектор до stem
function schemePref_(pref, pcwf) {
  let re = new RegExp('^' + pref.seg)
  pcwf = pcwf.replace(re, '')
  let conn = findConnection(pcwf)
  if (conn) {
    let reconn = new RegExp('^' + conn)
    pcwf = pcwf.replace(reconn, '')
  }
  return {conn, pcwf}
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
    // if (pterm != 'εω') continue
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
  let dicts = await getDicts(keys)
  dag.dictids = dicts.map(ddict=> ddict.stem)
  return dicts
}

// compound - προσαναβαίνω; ἀντιπαραγράφω
async function makePrefSegs(dag) {
    let prefsegs = []
    let headkeys = _.uniq(dag.flakes.map(flake=> plain(flake.head)))
    log('_headkeys', headkeys)
    let cprefs = await getPrefs(headkeys)
    if (!cprefs.length) return
    let max = _.maxBy(cprefs, function(pref) { return pref.term.length; })
    let prefs = await getPrefs(max.prefs)
    // log('_find_prefs_=', prefs)
    // log('_PCWF', dag.pcwf)
    // [{seg: term}, {seg: conn}, {seg: term}, {seg: conn}]

    let pcwf = dag.pcwf
    for (let pref of prefs) {
        let re = new RegExp(pref.term)
        pcwf = pcwf.replace(re, "-$&-")
    }
    // log('_PCWF_2', pcwf)
    let parts = pcwf.split('-').slice(1, -1)
    // log('_PARTS', parts)
    let segs = [], seg
    for (let part of parts) {
        let pref = prefs.find(pref=> pref.term == part)
        if (pref) seg = {seg: part, cdicts: [pref], pref: true}
        else seg = {seg: part, conn: true}
        segs.push(seg)
    }
    // log('_SEGS', segs)
    log('_XXX', dag.pcwf, max.term)
    let re = new RegExp('^' + max.term)
    dag.pcwf = dag.pcwf.replace(re, '')
    let conn = findConnection(dag.pcwf)
    if (conn) {
        re = new RegExp('^' + conn)
        dag.pcwf = dag.pcwf.replace(re, '')
        let augseg = {seg: conn, conn: true, aug: true}
        segs.push(augseg)
    }

    return segs

    max.prefs = cprefs.filter(pref=> pref.pref && !pref.cpref)
    // return {seg: max.term, cdicts: max.prefs, pref: true}
    return {seg: max.term, segs, pref: true}
}
