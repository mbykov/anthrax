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
let irdb
let flsdb
let nestdb

export async function createDBs(dnames) {
    dbs = []
    if (!flsdb) {
        const flspath = path.resolve(dbpath, 'fls')
        flsdb = new PouchDB(flspath)
        flsdb.dname = 'fls'
    }
    if (!irdb) {
        const indpath = path.resolve(dbpath, 'indecl')
        irdb = new PouchDB(indpath)
        irdb.dname = 'indecl'
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

export async function getInds(cwf) {
    // let keys = [cwf]
    let doc
    try {
        doc = await irdb.get(cwf, {include_docs: true});
    } catch(err) {
        // log('_not_found_ get_indecl', cwf)
        return []
    }
    return doc.docs
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

export async function fillTrns(cdicts) {
    let dictkeys = cdicts.map(cdict=> cdict.dict)
    dictkeys = _.uniq(dictkeys)
    // log('_TRNS_dictkeys', dictkeys)

    let trnsdicts = await getDicts(dictkeys)
    // log('_trnsdicts', trnsdicts)
    // let trns_rdicts = trnsdicts.map(cdict=> cdict.rdict)
    // log('_TRNS_trdicts', trns_rdicts)

    return trnsdicts
}
