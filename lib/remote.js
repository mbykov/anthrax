//
const log = console.log
import fetch from "node-fetch";
import _  from 'lodash'

export async function getDdicts (heads) {
    let data = {heads}
    /* log('_sgms heads data', data) */
    let url = 'http://localhost:3003/grc/wkt'
    let wkts = await doPost(url, data)
    // здесь get lsjs, dvors, soudas, etc
    // если есть wkts - взять wkt-morphs, либо слабый morphs
    return wkts
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
    let json = JSON.stringify(data)
		const res = await fetch(url, {
			  method: 'POST',
        mode: 'cors', // *
        credentials: 'same-origin', // *
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost',
        },
      	body: json
		})
    return await res.json()
}

export async function getPrefs (prefs) {
    let data = {terms: prefs}
    let url = 'http://localhost:3003/grc/term'
    let terms = await doPost(url, data)
    if (!terms.length || !terms[0].docs) return []
    let docs = _.flatten(terms.map(term=> term.docs)).filter(doc=> doc.pos == 'pref')
    return docs
}
