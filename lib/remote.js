//
const log = console.log
import fetch from "node-fetch";

// const PouchDB = require('pouchdb')

export async function getFlexes (keys) {
    log('_fetch keys', keys)
    /* let query = {query: card.text, lang} */

    let flexes = await doPost(keys)
    return flexes
}

async function doPost (tails) {
    let data = {tails}
    let json = JSON.stringify(data)
		const res = await fetch('http://localhost:3003/grc/flex', {
			  method: 'POST',
        mode: 'cors', // *
        credentials: 'same-origin', // *
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost',
        },
      	body: json
		})
    let flexes = await res.json()
    return flexes
}
