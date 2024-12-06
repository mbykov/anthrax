//
import PouchDB from 'pouchdb'
import _  from 'lodash'
import path  from 'path'

const log = console.log
const currentdir = process.cwd()
const dbpath = path.resolve(currentdir, '../pouch-anthrax')
// log('_dbpath', dbpath)

log('_ANTHRAX REMOTE')

let dbs = []
let alldbs = []
// let alldnames = ['wkt', 'bbh', 'dvr'] // , 'lsj' , 'bbl'
let alldnames = ['nest', 'wkt', 'dvr', 'lsj'] // , 'lsj' , 'bbl'

let existeds = ''
let flsdb

export async function createDBs(dnames) {
    dbs = []
    if (!flsdb) {
        const flspath = path.resolve(dbpath, 'fls')
        flsdb = new PouchDB(flspath)
        flsdb.dname = 'fls'
    }
    // if (alldbs.length == alldnames.length) return
    for (let dname of alldnames) {
        const dnamepath = path.resolve(dbpath, dname)
        // log('_dnamepath ', dname, dnamepath)
        const db = new PouchDB(dnamepath);
        db.dname = dname
        alldbs.push(db)
        if (dnames.includes(db.dname)) dbs.push(db)
    }
}

export async function getNests(keys) {
    let nestdb = dbs.find(db=> db.dname == 'nest')
    // log('_______GET NEST', dbs.length)
    let dicts = await getDB(keys, nestdb)
    return dicts
}

export async function getDicts(keys) {
    let dicts = []
    let dictdbs = dbs.filter(db=> db.dname != 'nest')
    for (let db of dictdbs) {
        if (db.dname == 'nest') continue
        let docs = await getDB(keys, db)
        // log('_getDicts dname', keys, db.dname, docs.length)
        dicts.push(...docs)
    }
    return dicts
}

async function getDB(keys, db) {
    let doc = await db.allDocs({keys, include_docs: true});
    let rdocs = _.compact(doc.rows.map(row=> row.doc))
    let docs = _.flatten(rdocs.map(rdoc=> rdoc.docs))

    docs.forEach(doc=> doc.dname = db.dname)
    return docs
}

export async function getFlexes (keys) {
    let doc = await flsdb.allDocs({keys, include_docs: true});
    let flexes = _.compact(doc.rows.map(row=> row.doc))
    // let jsons = flexes.map(flex => JSON.stringify(flex))
    // jsons = _.uniq(jsons)
    // flexes = jsons.map(json => JSON.parse(json))
    return flexes
}
