//

const log = console.log
// import fetch from "node-fetch";
import axios from 'axios';
import _  from 'lodash'

let stem = process.argv.slice(2)[0] //  'ἀργυρῷ'
let url = 'http://localhost:3003/grc/wkt'

log('_STEM', stem)

let heads = [stem]
// heads = ['γανακτ']
// heads = ['δεικν']
getDicts(url, heads)

async function getDicts (url, heads) {
    let data = { heads }
    log('_heads_data', url, data)
    let wkts = await doPost(url, data)

    log('_WKTS', wkts)
    let wktdocs = _.flatten(wkts.map(dict=> dict.docs))
    log('_WKT_DOCS', wktdocs)

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
