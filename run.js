//

import _  from 'lodash'
import { anthrax } from './index.js'
import { prettyName, prettyVerb } from './lib/utils.js'
import Debug from 'debug'
const d = Debug('dicts')

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'
let full = process.argv.slice(3)[0] //  'ἀργυρῷ'

const log = console.log

if (!wordform) log('no wordform')
else run(full)



async function run(full) {
    let chains = await anthrax(wordform)
    // log('_run_chains_:', chains)
    if (!chains.length) {
        log('no result')
        return
    }

    let indecl = chains[0].find(seg=> seg.indecl)
    if (indecl) {
        // log('_run_indecl_:', indecl)
        prettyIndecl(indecl)
        // let cdicts =
        if (full) {
            log('_cdicts:', indecl.cdicts)
        }
        return
    }

    for (let chain of chains) {
        log('_chain:', chain)
        let segs = chain.map(seg=> seg.seg).join('-')
        log('_scheme:', segs)
        // let fls = chain.map(seg=> seg.fls)
        // log('_fls:', fls)
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

function prettyIndecl(indecl) {
    for (let cdict of indecl.cdicts) {
        let fls = cdict.fls
        let morphs = ''
        if (cdict.fls) morphs = prettyName(fls)
        if (cdict.name) morphs = prettyName(fls)
        else if (cdict.verb) morphs = prettyVerb(fls)
        log('_indecl:', cdict.rdict, morphs)
    }
}
