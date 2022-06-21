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

// 1. вопросы: εἰσαγγέλλω // // // // // // // //
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
    // == TODO ==
    // аккуратно найти prefs / aug
    // в prefs-цикле найти breaks
    // найти значимые dicts, i.e. head-tail, кроме conn и flex
    // полные breaks - > chails
    // связки - bundles - анализ
    // aug во flex - глупо, перенести в dict
    // теперь связка может быть сложной, vows+pref+vows
    // то есть в breaks я не знаю, где dict, а где pref
    // анализ br-line начинать с конца - выбор dicts в зависимости от bundle - если vow+pref+vow, то сл. dict пропустить, это pref

    // в словаре pref отдельно. То есть искать длинный стем pref+stem не имеет смысла
    // если stem не найден, то и pref+stem не будет найден

    dag.prefs = await findPrefs(dag, dag.pcwf)
    log('_dag.prefs', dag.prefs)

    // remove pref or aug
    // breaks to chains
    if (!dag.prefs.length) {
        let aug = parseAug(dag.pcwf)
        if (aug) dag.pcwf = dag.pcwf.replace(aug, '')
        // здесь м.б. aug + pref !
        let zero = {seg: aug, cdicts: []}
        dag.prefs.push(zero)
    }

    for (let pref of dag.prefs) {
        let {aug, conn, pcwf} = schemePref(pref, dag.pcwf)
        log('_SOURCE_', aug, pref.seg, conn, pcwf)

        let breaks = makeBreaks(pcwf, dag.flexes)
        log('_breaks', breaks.length)
        let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-')) // todo: del
        log('_breaks-ids', breaksids)

        let dicts = await findDdicts(breaks)
        /* let ddictids = ddicts.map(ddict=> ddict._id) */
        let dictstems = _.uniq(dicts.map(dict=> dict.stem))
        log('_dictstems_uniq_:', dictstems)

        breaks = breaks.filter(brk=> {
            let ok = true
            if (brk.head && !dictstems.includes(brk.head)) ok = false
            if (brk.tail && !dictstems.includes(brk.tail)) ok = false
            return ok
        })
        log('_breaks_clean', breaks)

    }

    return

    let chains = []
    // todo: а если pref = a-привативум найден, а на самом деле просто aug?
    for await (let pref of dag.prefs) {
        let re = new RegExp('^' + pref.seg)
        let pcwf = dag.pcwf.replace(re, '')
        let {conn, tail} = findConnection(pcwf)
        log('_pref:', dag.pcwf, ':', pref.seg, conn, tail)
        if (conn) {
            let reconn = new RegExp('^' + conn)
            pcwf = pcwf.replace(reconn, '')
            pref.seg = pref.seg + conn
        }
        log('_pcwf', pcwf)

        let breaks = makeBreaks(pcwf, dag.flexes)
        log('_breaks', breaks.length)
        // todo: del - только инфо for log:
        let breaksids = breaks.map(br=> [br.head, br.conn, br.tail, br.fls._id].join('-'))
        log('_breaks-ids', breaksids)

        // note: συγκαθαιρέω - получаю συγ-καθαιρέω, и из него συγ-καθ-αιρέω, и еще συγκαθ-αιρέω, и из него συγ-καθ-αιρέω, т.е. 2 раза. Не страшно, но вызовет вопросы

        let dicts = await findDdicts(breaks)
        /* let ddictids = ddicts.map(ddict=> ddict._id) */
        let dictstems = _.uniq(dicts.map(dict=> dict.stem))
        log('_dictstems_uniq_:', dictstems)


        return []

        let prefchains = await combineChains(breaks, pref, augconn)
        /* prefchains.forEach(chain=> chain.unshift(pref)) */
        /* log('_prefchains', prefchains) */
        chains.push(...prefchains)
    }
    return chains
}

function schemePref(pref, pcwf) {
    let aug = ''
    if (!pref.seg) {
        let aug = parseAug(dag.pcwf)
        if (aug) pcwf = pcwf.replace(aug, '')
        return {aug, conn: '', pcwf}
    }
    let re = new RegExp('^' + pref.seg)
    pcwf = pcwf.replace(re, '')
    let {conn, tail} = findConnection(pcwf)
    // log('_pref:', dag.pcwf, ':', pref.seg, conn, tail)
    if (conn) {
        let reconn = new RegExp('^' + conn)
        pcwf = pcwf.replace(reconn, '')
    }
    // log('_pcwf', pcwf)
    return {aug, conn, pcwf}
}


async function combineChains(breaks, pref, augconn) {
    /* let ddicts = await findDdicts(breaks) */
    let dicts = await findDdicts(breaks)
    /* let ddictids = ddicts.map(ddict=> ddict._id) */
    let dictstems = _.uniq(dicts.map(dict=> dict.stem))
    log('_dictstems_uniq:', dictstems)

    let chains = []
    for await (let br of breaks) {
        // log('____BREAK____', br.head, 'conn:', br.conn,  'tail:', br.tail)
        let headdicts = dicts.filter(dict=> dict.stem == br.head)
        if (!headdicts.length) continue

        let chain = []
        let dictfls = []
        if (pref.nopref) {
            if (br.tail) {
                let taildicts = dicts.filter(dict=> dict.stem == br.tail)
                if (!taildicts.length) continue

                if (br.conn) { //  πολύτροπος, ψευδολόγος, χρονοκρατέω, βαρύτονος
                    /* log('_HEADDICTS', headdicts) */
                    log('_CMB_NO_PREF_CONN_TAIL', br.head, br.conn, br.tail) // todo: м.б. случай, когда соед. гласная, а затем aug
                    taildicts = taildicts.filter(dict=> aug2vow(br.conn, dict.aug))
                    /* log('_TAILDICTS', taildicts) */
                    dictfls = await dict2flexFilter(taildicts, br.fls.docs)
                    if (!dictfls.length) continue

                    if (dag.aug) headdicts = headdicts.filter(dict=> dict.aug)
                    else headdicts = headdicts.filter(dict=> !dict.aug)

                    chain = [{seg: br.head, dicts: headdicts}, {seg: br.conn}, {seg: br.tail, cdicts: dictfls}, {seg: br.fls._id, flex: true}]
                    dictfls = [] // <<<============

                } else { // compound без коннектора
                    taildicts = taildicts.filter(dict=> !dict.aug)
                    log('_CMB_NO_PREF_NO_CONN_TAIL', br.head, br.conn, br.tail)
                }

            } else {
                // simple: strong - это cdicts, т.е. dicts + fls
                // ищем wkt: если strong есть, выбираем lsj с там же stem, aug, type, присваиваем найденный morphs
                // если wkt нет, ищем weak, т.е. не по ключам, а только по типу
                // compound: всегда weak
                // === todo - dicts сделать объектом - dicts.fls, dicts.jsj, etc

                log('_CMB_SIMPLE_', br.head, br.conn, br.tail)
                let {cdicts, cfls} = dict2flexFilter(dag.aug, headdicts, br.fls.docs)
                if (!cdicts.length) continue

                chain = [{seg: br.head, cdicts}, {seg: br.fls._id, flex: true, cfls}]
                if (dag.aug) chain.unshift({seg: dag.aug, aug: true})

                chains.push(chain)

                // dictfls = []
                // let wkts = headdicts.filter(dict=> dict.dname == 'wkt')
                // let lsjs = headdicts.filter(dict=> dict.dname != 'wkt')

                // // пока вернулся без Strong
                // // let cdicts = await dict2flexStrong(wkts, br.fls.docs)
                // let cdicts = dict2flexFilter(wkts, br.fls.docs)

                // for (let cdict of cdicts) {
                //     /* log('_XXXXX_dict2flexStrong', cdict.dict.rdict) */
                //     /* log('_XXXXX_DAG.AUG', dag.aug, 'cdict.aug', cdict.dict.aug) */
                //     /* if (dag.aug != cdict.dict.aug) continue */
                //     // плохо - может проскочить flex для отброшенного dict.aug
                //     let clsjs = lsjs.filter(lsjdict=> lsjdict.type == cdict.dict.type && lsjdict.aug == cdict.dict.aug && lsjdict.stem == cdict.dict.stem)
                //     chain = [{seg: br.head, wkt: cdict.dict, lsjs: clsjs[0]}, {seg: br.fls._id, fls: cdict.cfls}]
                //     chains.push(chain)
                // }
                // // log('_SIMPLE CHAIN', chain)
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

async function dict2flexStrong(wkts, fls) {
    let cdicts = []
    for (let dict of wkts) {
        log('____________________STRONG dict', dict.type, dict.stem, dict.rdict, dict.dname)
        let cfls = []
        for await (let flex of fls) {
            if (dict.stem == 'γειρ') log('____STRONG FLEX', flex.key)
            let ok = false
            let flextype = flex.key.split('-')[0] // ====== TODO: flex.type добавить во flex, и тут flextype убрать
            // dict.type == flextype && =>
            // плохо - сейчас keys прилагательных не совпадают с существительными, нужно переделать adjectives согласно плану
            let keyXXX = dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5)
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true
            /* if (!dict.aug) log('_=========keyXXX', dict.rdict, keyXXX, '_OK', ok) */
            /* if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true */

            if (ok) cfls.push(flex)
        }
        if (cfls.length) cdicts.push({dict, cfls})
    }
    /* log('_XXXXX_CDICTS', cdicts) */
    return cdicts
}

function dict2flexFilter(aug, dicts, fls) {
    let cdicts = []
    let cfls = []
    fls = fls.filter(flex=> flex.aug == aug)
    for (let dict of dicts) {
        // if (!dict.keys) log('_dict-no-keys',dict)
        // log('___dict:', dict.rdict)
        let dfls = []
        for(let flex of fls) {
            log('_flex:', flex.numper, flex.tense, flex.term)
            let ok = false
            /* if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug && dag.stress.md5 == flex.stress.md5) ok = true */
            if (dict.name && flex.name && dict.keys.find(key=> key.gend == flex.gend && key.md5 == flex.md5) && dict.aug == flex.aug) ok = true
            else if (dict.name && flex.adv && dict.keys.adv && dict.keys.adv == flex.key) ok = true
            else if (dict.part && flex.part ) ok = true
            // else if (dict.verb && flex.verb) ok = true
            // if (dict.verb && flex.verb) ok = true
            else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense)) ok = true
            // else if (dict.verb && flex.verb && dict.keys.find(dkey=> dkey.tense == flex.tense && dkey.key == flex.key)) ok = true
            /* else if (compound && dict.verb && flex.name && vnTerms.includes(key)) ok = true // heads.length - compounds */
            // if (ok) dict.fls.push(flex)
            if (ok) dfls.push(flex)
        }
        if (dfls.length) log('____dict.fls', dict.stem, dict.rdict, cfls.length)
        if (dfls.length) {
            cdicts.push(dict)
            cfls.push(dfls)
        }
    }
    // log('_____filter: cfls', cfls)
    return {cdicts, cfls}
}

// ================================================= FILTERS ==============
function dict2flex_(dicts, fls, simple) {
    let cdicts = []
    for (let cdict of dicts) {
        let dict = _.clone(cdict)
        log('____________________dict', dict.stem, dict.rdict, dict)
        dict.fls = []
        for (let flex of fls) {
            // log('_flex:', flex.term)
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
        // if (pterm != 'εω') continue
        let phead = pcwf.slice(0, -pterm.length)
        let pos = phead.length + 1
        let head, tail, vow, connection, res
        while (pos > 0) {
            pos--
            head = phead.slice(0, pos)
            if (!head) continue
            // if (!head || vowels.includes(_.last(head))) continue // зачем я это добавил?
            // todo: наверное, на след шагу в conn чтобы сразу добавить гласную
            // но в простейшем ἀγαθοποιέω окончание έω, а head заканчивается на гласную, отбросить гласную здесь нельзя
            tail = phead.slice(pos)
            connection = findConnection(tail)
            if (connection.conn && connection.tail) {
                res = {head, conn: connection.conn, tail: connection.tail, fls}
                // log('_BR_c', head, connection.conn, connection.tail, fls._id)
            } else {
                // log('_BR', head, tail, fls._id)
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
    p('_find_prefs', prefs)
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
