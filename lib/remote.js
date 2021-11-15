//
const log = console.log
import fetch from "node-fetch";

// const PouchDB = require('pouchdb')

export async function getSegments (heads) {
    log('_sgms heads', heads)
    let data = {heads}
    let url = 'http://localhost:3003/grc/wkt'
    let segms = await doPost(url, data)
    return segms
}

export async function getFlexes (keys) {
    log('_fetch keys', keys)
    let data = {tails: keys}
    let url = 'http://localhost:3003/grc/flex'
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
