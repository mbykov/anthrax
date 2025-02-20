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

// let verbose = process.argv.slice(3)[0] //  'ἀργυρῷ'

log('_STEM', stem) // γανακτ ; δεικν ;
// let heads = [stem]


const currentdir = process.cwd()
// const dbpath = path.resolve(currentdir, '../pouch-anthrax')
const dbpath = '/home/michael/greek/pouch-anthrax'
log('_dbpath', dbpath)
const dnamepath = path.resolve(dbpath, dname)
log('_dnamepath ', dnamepath)
const db = new PouchDB(dnamepath);

if (stem == 'info') getInfo(dname)
else getDicts(stem, dname)

async function getDicts(stem) {
    log('_getDicts_', stem)
    stem = comb(stem) // на случай поиска dict, а не stem в словарях
    try {
        let doc = await db.get(stem, {include_docs: true});
        log('_doc_', doc)
        let docs = doc.docs
        for (let doc of docs) {
            // if (doc.rdict != 'νύξ') continue
            if (doc.ckeys) doc.ckeys = doc.ckeys.length // indecls have no ckeys
            // log('_get_doc_', doc)
        }
    } catch (err) {
        console.log('_not_found');
    }
}

async function getInfo(dname) {
    try {
        let info = await db.info();
        log('_info_', info)
    } catch (err) {
        console.log('_no_info', dname);
    }

}
