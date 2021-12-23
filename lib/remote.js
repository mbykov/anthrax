//
const log = console.log
import fetch from "node-fetch";

// const PouchDB = require('pouchdb')

export async function getSegments (heads) {
    let data = {heads}
    log('_sgms heads data', data)
    let url = 'http://localhost:3003/grc/wkt'
    let segms = await doPost(url, data)
    return segms
}

export async function getFlexes (keys) {
    let data = {tails: keys}
    log('_fetch flexes', data)
    let url = 'http://localhost:3003/grc/flex'
    let flexes = await doPost(url, data)
    return flexes
}

export async function getTerms (wf) {
    let data = {terms: [wf]}
    log('_fetch terms keys', data)
    let url = 'http://localhost:3003/grc/term'
    let flexes = await doPost(url, data)
    return flexes
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
