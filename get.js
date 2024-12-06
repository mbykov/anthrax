//

const log = console.log
import PouchDB from 'pouchdb'
import _ from 'lodash'
// import fse from 'fs-extra'
import path  from 'path'
import {oxia, comb, plain, strip} from 'orthos'

let stem = process.argv.slice(2)[0] //  'ἀργυρῷ' // ἡγέομαι

stem = comb(stem)

let dname = process.argv.slice(3)[0] || 'wkt'

log('_STEM', stem) // γανακτ ; δεικν ;
// let heads = [stem]


const currentdir = process.cwd()
// const dbpath = path.resolve(currentdir, '../pouch-anthrax')
const dbpath = '/home/michael/greek/pouch-anthrax'
log('_dbpath', dbpath)
const dnamepath = path.resolve(dbpath, dname)
log('_dnamepath ', dnamepath)
const db = new PouchDB(dnamepath);

getDicts(stem)

async function getDicts (stem) {
    log('_getDicts_', stem)
    try {
        let doc = await db.get(stem);
        let docs = doc.docs
        for (let doc of docs) {
            // if (doc.rdict != 'νύξ') continue
            log('_get_doc_', doc)
        }
    } catch (err) {
        console.log('_not_found');
    }

}
