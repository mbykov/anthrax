//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'

const currentdir = process.cwd()

let only = process.argv.slice(10)[0] //  'ἀργυρῷ'
// let wform = process.argv.slice(11)[0] //


import { prettyName } from '../lib/utils.js'
// import { getFile } from './lib/utils.js'

import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

import { adjs } from '../../fetchers/fetcher-wkt/lib/adjs_list.js'
let names = adjs //.map(name=> comb(name))
log('_NAMES', names.length)

// names = names // .slice(0, 20)
// names = ['ἁβρός']
// log('_NAMES', names)

let nth_names = []

let delta = 100
for (let i = 0; i < names.length; i=i+delta) {
    nth_names.push(names[i]);
}

log('_nth_names', nth_names.length)

// nth_names = ['ἀγγελικός']

let skip = only ? true : false

for (let name of nth_names) {
    if (only && only == name) skip = false
    // log('_NAME', only, name, only == name)
    if (skip) continue
    let file
    try {
        // log('_N', name)
        file = getFile(name)
    } catch(err) {
        log('_ERR FILE', name)
        continue
    }

    for (let dialect of file.dialects) {
        if (!dialect.gends) continue // non-adjective
        // log('_D', dialect)
        for (let form of dialect.forms) {
            let wf = form.wf.toLowerCase()
            let cwf = comb(wf)
            let ckey = [file.rdict, cwf].join('-')
            if (!cache[ckey]) cache[ckey] = []
            let cform = _.clone(form)
            cache[ckey].push(cform)
            // for (let gend of dialect.gends) {
            //     let cform = _.clone(form)
            //     if (!cform.adv) cform.gend = gend
            //     cache[ckey].push(cform)
            // }
        }
    }

}

// log('_CACHE', only, cache)
log('_TESTS nth_', _.keys(cache).length)

describe('test names:', async () => {
    for (let ckey in cache) {
        let rdict = ckey.split('-')[0]
        let wf = ckey.split('-')[1]
        let expected = cache[ckey].map(form=> {
            if (!form.adv)  return [form.gend, form.num, form.case].join('.')
            else return ['adv', form.atype].join('.')
        }).sort()
        // log('_EXP', wf, ckey, expected)
        await testWF(rdict, wf, expected)
    }
})

async function testWF(rdict, wf, exp) {
    it(`rdict:  ${rdict} wf:  ${wf}`, async () => {
        let morphs = []
        let chains = await anthrax(wf)
        if (!chains.length) {
            // assert.deepEqual(true, true)
            // return
        }
        // log('_CHAINS', wf, chains.length)

        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        let names = chains.filter(chain=> chain.find(seg=> seg.main && seg.name))
        
        // log('_NAMES', wf, names.length)
        for (let chain of names) {
            // log('_MAIN_CHAIN', chain)
            let names = chain.find(seg=> seg.main).cdicts
            let rdicts = names.map(name=> name.rdict.toLowerCase())
            // log('_names:', rdicts)
            // if (!rdicts.includes(rdict)) continue // ἐσχατιά; ἐσχατιή

            // let gends = names[0].dialects.find(dia=> dia.gends) // non-adective
            // if (gends) continue

            // log('_CDICTS', wf, cdicts)
            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)
            let cmorphs = prettyName(fls)
            // morphs.push(...cmorphs)
            // log('_EXP', wf, exp)
            cmorphs = _.uniq(cmorphs).sort()
            assert.deepEqual(cmorphs, exp)
        }
    })
}

function getFile(fn) {
    fn = [fn, 'json'].join('.')
    const dirPath = path.resolve(currentdir, '../morph-data/wkt/adjectives')
    let fnpath = [dirPath, fn].join('/')
    // log('_fnpath', fnpath)
    let file = fse.readJsonSync(fnpath)
    return file
}

function prettyIndecl(indecl) {
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
