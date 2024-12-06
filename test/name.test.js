//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
// import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
// import { nameTests } from './lib/makeNameTests.js'
// import { adjTests } from './lib/makeAdjTests.js'

const currentdir = process.cwd()
let only = process.argv.slice(10)[0] //  'ἀργυρῷ'


import { prettyName } from '../lib/utils.js'
import { anthrax } from '../index.js'

import Debug from 'debug'
const d = Debug('test')

log('_ONLY', only)
let cache =  new Map();
/* let res = {} */

import { nouns } from '../../fetchers/fetcher-wkt/lib/nouns_list.js'
let names = nouns //.map(name=> comb(name))
log('_NAMES', names.length)

// names = names.slice(0, 20)
// names = ['ἄγκυρα']
// names = ['ἄρκυς']
// names = ['ἐσχατιά']
// ἐσχατιά = ἐσχατιά

// log('_NAMES', names)

let nth_names = []

let delta = 100
for (let i = 0; i < names.length; i=i+delta) {
    nth_names.push(names[i]);
}

// nth_names = ['ἄγαλμα']

log('_nth_names', nth_names.length)

let skip = only ? true : false

for (let name of nth_names) {
    if (only && only == name) skip = false
    // log('_NAME', only, name, only == name, skip)
    if (skip) continue
    let file
    try {
        file = getFile(name)
    } catch(err) {
        // const dirPath = path.resolve(currentdir, '../morph-data/wkt/nouns')
        // log('_ERR FILE', name, dirPath)
        continue
    }

    for (let dialect of file.dialects) {
        if (!dialect.gends) continue // non-adjective
       // log('_D', dialect)
        for (let form of dialect.forms) {
            let wf = form.wf.toLowerCase()
            let cwf = comb(wf)
            // let pwf = plain(form.wf) // нельзя, объединяются разные формы с острым и облеченным ударением, Ἀβδηρίτης
            let ckey = [file.rdict, cwf].join('-')
            if (!cache[ckey]) cache[ckey] = []
            for (let gend of dialect.gends) {
                let cform = _.clone(form)
                cform.gend = gend
                cache[ckey].push(cform)
            }
      }
    }

}

// log('_CACHE', only, cache)
log('_TESTS nth_', _.keys(cache).length)

describe('test names:', async () => {
    for (let ckey in cache) {
        let rdict = ckey.split('-')[0]
        let wf = ckey.split('-')[1]
        let expected = cache[ckey].map(form=> [form.gend, form.num, form.case].join('.')).sort()
        expected = _.uniq(expected)
        // log('_EXP', wf, expected)
        await testWF(rdict, wf, expected)
    }
})

async function testWF(rdict, wf, exp) {
    it(`rdict:  ${rdict} wf:  ${wf}`, async () => {
        let morphs = []
        let chains = await anthrax(wf, ['wkt'])
        if (!chains.length) {
            assert.deepEqual(true, true)
            return
        }

        // log('_EXP', wf.key, exp)
        chains = chains.filter(chain=> !chain.find(seg=> seg.head)) // не compounds
        chains = chains.filter(chain=> !chain.find(seg=> seg.pref)) //
        chains = chains.filter(chain=> !chain.find(seg=> seg.indecl)) //
        let namechains = chains.filter(chain=> chain.find(seg=> seg.main && seg.name))

        for (let chain of namechains) {
            // log('_CHAIN', chain.length)
            let names = chain.find(seg=> seg.main).cdicts
            let rdicts = names.map(name=> name.rdict.toLowerCase())
            // log('_names:', rdicts, rdict)
            if (!rdicts.includes(rdict)) continue // ἐσχατιά; ἐσχατιή

            // let gends = names[0].dialects.find(dia=> dia.gends) // non-adective
            // if (!gends) continue
            // log('_names:', rdicts, rdict)

            let fls = chain.find(seg=> seg.fls).fls
            // log('_FLS', fls)
            let cmorphs = prettyName(fls)
            cmorphs = _.uniq(cmorphs).sort()
            // log('_EXP', wf, exp, cmorphs)
            assert.deepEqual(cmorphs, exp)
        }
    })
}


function prettyIndecl(chain) {
    let vmorphs = []
    let indseg = chain.find(seg=> seg.indecl)
    for (let cdict of indseg.cdicts) {
        let fls = cdict.fls
        let morphs = ''
        if (cdict.fls) morphs = prettyName(fls)
        // log('_indecl:', cdict.term, morphs)
        vmorphs.push(...morphs)
    }
    return _.uniq(vmorphs).sort()
}

function compactNamesFls_(dicts) {
    let fls = dicts.map(dict=> {
        return dict.fls.filter(flex=> !flex.adv).map(flex=> [flex.gend, flex.num, flex.case].join('.'))
    })
    return _.uniq(_.flatten(fls).sort())
}

function compactNameFls_(flexes) {
    return _.uniq(flexes.map(flex=> [flex.gend, flex.num, flex.case].join('.')))
}

function getFile(fn) {
    fn = [fn, 'json'].join('.')
    const dirPath = path.resolve(currentdir, '../morph-data/wkt/nouns')
    let fnpath = [dirPath, fn].join('/')
    let file = fse.readJsonSync(fnpath)
    return file
}
