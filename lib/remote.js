//
const log = console.log
// import fetch from "node-fetch";
import axios from 'axios';

import _  from 'lodash'

let grchost = 'http://localhost:3003/grc/'

async function getDB(heads, dname) {
    let data = { heads }
    let url = grchost + dname
    let dicts = await doPost(url, data)
    // log('_WKTDOCS', wkts.length)
    // let rdicts = wkts[0].docs.map(dict=> dict.rdict).join(',')
    // log('_WKT rdicts', rdicts)
    let dictdocs = _.flatten(dicts.map(dict=> dict.docs))
    dictdocs.forEach(doc=> doc.dname = 'wkt')
    log('_dicts', dname, dictdocs.length)
    return dictdocs
}

export async function getDicts (heads, dbs) {
    let results = []
    // log('_getDicts', url, data)
    if (!dbs.length) dbs = ['wkt', 'dvr', 'bbl'] , 'lsj'
    for (let dname of dbs) {
        let dictdocs = await getDB(heads, dname)
        results.push(...dictdocs)

    }
    return results


    // здесь get lsjs, dvors, soudas, etc
    // и если есть wkts - взять wkt-morphs, либо слабый morphs - здесь ли это решать? не здесь, конечно
    url = 'http://localhost:3003/grc/lsj'
    let lsjs = await doPost(url, data)
    let lsjdocs = _.flatten(lsjs.map(dict=> dict.docs))
    // lsjdocs.forEach(doc=> doc.dname = 'lsj')
    // log('_LSJDOCS', lsjdocs.length)
    // wktdocs.push(...lsjdocs)

    url = 'http://localhost:3003/grc/dvr'
    let dvrs = await doPost(url, data)
    let dvrdocs = _.flatten(dvrs.map(dict=> dict.docs))
    dvrdocs.forEach(doc=> doc.dname = 'dvr')
    log('_DVRDOCS', dvrdocs.length)
    wktdocs.push(...dvrdocs)

    url = 'http://localhost:3003/grc/bbl'
    let bbls = await doPost(url, data)
    let bbldocs = _.flatten(bbls.map(dict=> dict.docs))
    bbldocs.forEach(doc=> doc.dname = 'bbl')
    log('_BBLDOCS', bbldocs.length)
    wktdocs.push(...bbldocs)

    // =============== NB: !!!!
    // wktdocs = wktdocs.filter(doc=> heads.includes(doc.dict))
    return wktdocs
}

async function doPost (url, data) {
    let res = []
    try {
        res = await axios.post(url, data);
        res = res.data
    } catch(err) {
        log('_ECONNREFUSED')
    }
    return res
}

export async function getFlexes (keys) {
    let data = {tails: keys}
    /* log('_fetch flexes', data) */
    let url = 'http://localhost:3003/grc/flex'
    let flexes = await doPost(url, data)
    return flexes
}

// export async function getTerms (cwf) {
//     let data = {terms: [cwf]}
//     let url = 'http://localhost:3003/grc/term'
//     let terms = await doPost(url, data)
//     if (!terms.length || !terms[0].docs) return []
//     return terms[0].docs
//     /* return compactTerms(terms) */
// }

// export async function getTermsNew (cwf) {
//     let data = {terms: [cwf]}
//     let url = 'http://localhost:3003/grc/term'
//     let terms = await doPost(url, data)
//     if (terms.length) terms = terms[0].docs
//     terms.forEach(doc=> doc.dname = 'terms')

//     data = { heads: [cwf]}
//     // url = 'http://localhost:3003/grc/wkt'
//     // let wkts = await doPost(url, data)
//     // let wktdocs = _.flatten(wkts.map(dict=> dict.docs))
//     // // log('_getTermsNew dvrdocs', dvrdocs)
//     // wktdocs.forEach(doc=> doc.dname = 'wkt')

//     url = 'http://localhost:3003/grc/dvr'
//     let dvrs = await doPost(url, data)
//     let dvrdocs = _.flatten(dvrs.map(dict=> dict.docs))
//     // log('_getTermsNew dvrdocs', dvrdocs)
//     dvrdocs.forEach(doc=> doc.dname = 'dvr')

//     let docs = []
//     // docs.push(...wktdocs)
//     docs.push(...terms)
//     docs.push(...dvrdocs)
//     return docs
// }

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

// export async function getPrefs (prefs) {
//     let data = {terms: prefs}
//     let url = 'http://localhost:3003/grc/term'
//     let terms = await doPost(url, data)
//     if (!terms.length || !terms[0].docs) return []
//     let docs = _.flatten(terms.map(term=> term.docs)).filter(doc=> doc.pref)
//     docs.forEach(doc=> doc.dname = 'wkt')
//     return docs
// }
