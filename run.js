//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyName, prettyIndecl, prettyVerb } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let full = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

if (!wordform) log('no wordform')
else run(full)

async function run(full) {
    let chains = await anthrax(wordform)
    log('_run_chains_:', chains.length)

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
        if (full) {
            log('_cdicts:', indecl.cdicts)
        }
        return
    }

    for (let chain of chains) {
        // log('_chain:', chain)
        let mainseg = chain.find(seg=> seg.mainseg)
        let rdict = mainseg.cdicts[0].rdict
        // log('_M:', mainseg.cdicts[0].keys)
        let segs = chain.map(seg=> seg.pref || seg.seg).join('-')
        log('_scheme:', rdict, segs)
        let flseg = chain.find(seg=> seg.fls)
        // log('_fls_xx:', flseg.fls.length)
        // let mainseg = chain.find(seg=> seg.mainseg)
        // log('_M:', mainseg.cdicts[0].keys)
        for (let flex of flseg.fls) {
            // log('_FLEX', flex.aug, flex.rdict)
        }

        let pretty = prettyFLS(chain)
        log('_morphs:', pretty)
        if (full) {
            let main = chain.find(seg=> seg.mainseg)
            log('_cdicts:', main.cdicts)
        }
    }
}

function prettyFLS(chain) {
    let mseg = chain.find(seg=> seg.mainseg)
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
