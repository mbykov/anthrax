//
import PouchDB from 'pouchdb'
import _  from 'lodash'
import path  from 'path'

const log = console.log
const currentdir = process.cwd()
const dbpath = path.resolve(currentdir, '../pouch-anthrax')
// log('_dbpath', dbpath)

// log('_ANTHRAX REMOTE')

let dbs = []
let idbs = []
let alldnames = ['wkt', 'dvr', 'lsj', 'bbl'] // , 'gram'

let inddb
let flsdb
let nestdb

export async function createDBs() {
    dbs = []
    if (!flsdb) {
        const flspath = path.resolve(dbpath, 'fls')
        flsdb = new PouchDB(flspath)
        flsdb.dname = 'fls'
    }
    if (!inddb) {
        const indpath = path.resolve(dbpath, 'indecl')
        inddb = new PouchDB(indpath)
        inddb.dname = 'indecl'
    }
    const nestpath = path.resolve(dbpath, 'nest')
    nestdb = new PouchDB(nestpath)
    nestdb.dname = 'nest'

    for (let dname of alldnames) {
        const dnamepath = path.resolve(dbpath, dname)
        const db = new PouchDB(dnamepath);
        db.dname = dname
        dbs.push(db)

        let idname = 'i' + dname
        const idnamepath = path.resolve(dbpath, idname)
        const idb = new PouchDB(idnamepath);
        idb.dname = idname
        idbs.push(idb)
    }
}

export async function getNests(keys) {
    let dicts = await getDB(keys, nestdb)
    let rdicts = dicts.map(dict=> dict.rdict)
    // log('_______GET remote NEST', rdicts)
    // log('_______GET remote NEST keys', keys)
    return dicts
}

// export async function getInds(cwf) {
//     // let keys = [cwf]
//     let doc
//     try {
//         doc = await inddb.get(cwf, {include_docs: true});
//         // log('_indecl doc', cwf, doc)
//     } catch(err) {
//         // log('_not_found_ get_indecl', cwf)
//         return []
//     }
//     return doc.docs
// }

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

// only from dnames
export async function getTrns(dictkeys, dnames) {
    dnames = alldnames //  пока что
    let dicts = []
    for (let db of dbs) {
        if (!dnames.includes(db.dname)) continue
        let docs = await getDB(dictkeys, db)
        docs.forEach(doc=> doc.dname = db.dname)
        // log('_getTrns dname', keys, db.dname, docs.length)
        dicts.push(...docs)
    }
    return dicts
}

export async function getIndecls(cwf, dnames) {
    let dicts = []
    for (let db of idbs) {
        let woiname = db.dname.replace(/^i/, '')
        if (!dnames.includes(woiname)) continue
        let docs = await getDB([cwf], db)
        docs.forEach(doc=> doc.dname = db.dname)
        dicts.push(...docs)
    }
    return dicts
}
