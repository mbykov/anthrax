//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyName, prettyIndecl, prettyVerb } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

if (!wordform) log('no wordform')
else run(verbose)

async function run(verbose) {
    let chains = await anthrax(wordform)
    log('_run_chains_:', chains.length)

    for (let chain of chains) {
        let res = {}
        for (let seg of chain) {
            if (seg.aug) res.aug = seg.aug
            else if (seg.pref && !seg.main) res.pref = [seg.pref, seg.conn].join('-')
            else if (seg.main) {
                let probe = chain.find(seg=> seg.main).cdicts[0]
                res.rdict = probe.rdict, res.stem = probe.stem, res.dname = probe.dname
                if (probe.pref) res.pref_main = probe.pref
                if (probe.verb) res.verb = true
                else if (probe.name) res.name = true
            }
            else if (seg.fls) res.fls = seg.seg
        } // seg
        if (verbose) log('_chain', res)
    }


    if (!chains.length) {
        log('no result')
        return
    }

    let indecl = chains[0].find(seg=> seg.indecl)
    // log('_INDECL_:', indecl)

    if (indecl) {
        log('_run_indecl_:', indecl)
        let pretty = prettyIndecl(indecl)
        log('_indecl morphs:', pretty)
        if (verbose) {
            log('_cdicts:', indecl.cdicts)
        }
        return
    }

    for (let chain of chains) {
        // log('_chain:', chain)
        // let main = chain.find(seg=> seg.main)
        // let cdict = main.cdicts[0]
        // let rdict = cdict.rdict
        // // log('_M:', main.cdicts[0].keys)
        let probe, dbs
        let segs = chain.map(seg=> {
            if (seg.aug) return seg.seg
            else if (seg.pref && !seg.main) return [seg.pref, seg.conn].join('-')
            else if (seg.main) {
                dbs = seg.cdicts.map(dict=> dict.dname)
                probe = seg.cdicts[0]
                let scheme = [seg.seg]
                if (seg.aug) scheme.unshift(seg.aug)
                else if (probe.pref) {
                    if (probe.conn) scheme.unshift(probe.conn)
                    scheme.unshift(probe.pref)
                }
                scheme = scheme.join('.')
                return scheme
            }
            else if (seg.fls) return seg.seg
        }).join('-')
        log('_scheme:', probe.rdict, '_segs:', segs, '_dbs:', dbs) // , cdict.scheme
        let flseg = chain.find(seg=> seg.fls)
        // log('_fls_xx:', flseg.fls.length)
        // let main = chain.find(seg=> seg.main)
        // log('_M:', main.cdicts[0].keys)
        for (let flex of flseg.fls) {
            // log('_FLEX', flex.aug, flex.rdict)
        }

        let pretty = prettyFLS(chain)
        log('_morphs:', pretty)
    }
}

function prettyFLS(chain) {
    let mseg = chain.find(seg=> seg.main)
    let fls = chain.find(seg=> seg.fls).fls
    let morphs = ''
    if (mseg.name) morphs = prettyName(fls)
    else if (mseg.verb) morphs = prettyVerb(fls)
    return morphs
}

function prettyIndecl_(indecl) {
    let vmorphs = []
    for (let cdict of indecl.cdicts) {
        let morphs = ''
        if (cdict.fls) {
            let morphs = prettyName(cdict.fls)
            vmorphs.push(...morphs)
        } else if (cdict.adv) {
            let advmorph = ['adverb', cdict.atype].join('.')
            vmorphs.push(advmorph)
            // log('_indecl:', cdict.term, morphs)
        }
    }
    return _.uniq(vmorphs).sort()
}

function prettyName_(fls) {
    let morphs = fls.map(flex=> {
        return  [flex.gend, flex.numcase].join('.')
    })
    return _.uniq(morphs).sort()
}

function prettyVerb_(fls) {
    let morphs = fls.map(flex=> {
        let str
        // if (flex.part) str =[ [flex.tense, flex.numper].join('.'),  [flex.gend, 'sg.nom'].join('.') ].join(', ')
        if (flex.part) str = [flex.tense,  [flex.gend, flex.numcase].join('.') ].join(', ')
        else if (flex.inf) str = flex.tense
        else str = [flex.tense, flex.numper].join(', ').trim()
        return str
    })
    return _.uniq(morphs).sort()
}
