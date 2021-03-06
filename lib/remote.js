//
const log = console.log
// import fetch from "node-fetch";
import axios from 'axios';

import _  from 'lodash'

export async function getDdicts (heads) {
    let data = { heads }
    // log('_heads_data', data)
    let url = 'http://localhost:3003/grc/wkt'
    let wkts = await doPost(url, data)

    /* log('_WKTS', wkts) */
    let wktdocs = _.flatten(wkts.map(dict=> dict.docs))
    wktdocs.forEach(doc=> doc.dname = 'wkt')
    // log('_WKTDOCS', wktdocs.length)

    // здесь get lsjs, dvors, soudas, etc
    // и если есть wkts - взять wkt-morphs, либо слабый morphs - здесь ли это решать? не здесь, конечно
    url = 'http://localhost:3003/grc/lsj'
    let lsjs = await doPost(url, data)
    let lsjdocs = _.flatten(lsjs.map(dict=> dict.docs))
    lsjdocs.forEach(doc=> doc.dname = 'lsj')
    // log('_LSJDOCS', lsjdocs.length)

    wktdocs.push(...lsjdocs)

    return wktdocs
}

export async function getFlexes (keys) {
    let data = {tails: keys}
    /* log('_fetch flexes', data) */
    let url = 'http://localhost:3003/grc/flex'
    let flexes = await doPost(url, data)
    return flexes
}

export async function getTerms (cwf) {
    let data = {terms: [cwf]}
    let url = 'http://localhost:3003/grc/term'
    let terms = await doPost(url, data)
    if (!terms.length || !terms[0].docs) return []
    return terms[0].docs
    /* return compactTerms(terms) */
}

// chain: [ { plain: 'κακ', cdicts: [ [Object] ], flex: 'ία' } ]
// зачем plain? только для справки, и flex тоже? т.е. chain
// αἰών - m, но м.б. и m.f. ? - нужно группировать по gend? найти пример

function compactTerms(terms) {
    /* let cterms = terms */
    let groups = _.groupBy(terms[0].docs, 'gend')
    /* log('_T:', terms[0].docs) */
    /* log('_G:', groups) */
    for (let gend in groups) {
        let dicts = groups[gend]
        log('_D:', gend, dicts)
    }

    let cdicts = terms[0].docs
    cdicts.forEach(cdict=> cdict.fls= [])
    return [[{cdicts}]]
}


async function doPost (url, data) {
    let res = await axios.post(url, data);
    return res.data
}

export async function getPrefs (prefs) {
    let data = {terms: prefs}
    let url = 'http://localhost:3003/grc/term'
    let terms = await doPost(url, data)
    if (!terms.length || !terms[0].docs) return []
    let docs = _.flatten(terms.map(term=> term.docs)).filter(doc=> doc.pos == 'pref')
    return docs
}
