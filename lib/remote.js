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
let cacheDdb // dicts
let cacheIdb // indecls
let cacheNdb // nest

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
    if (!cacheDdb) {
        const cacheDpath = path.resolve(dbpath, 'cacheD')
        cacheDdb = new PouchDB(cacheDpath)
        cacheDdb.dname = 'cacheD'
    }
    const nestpath = path.resolve(dbpath, 'nest')
    nestdb = new PouchDB(nestpath)
    nestdb.dname = 'nest'

    const cacheIpath = path.resolve(dbpath, 'cacheI')
    cacheIdb = new PouchDB(cacheIpath)
    cacheIdb.dname = 'cacheI'

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
    // let rdicts = dicts.map(dict=> dict.rdict)
    // log('_______GET remote NEST', rdicts)
    // log('_______GET remote NEST keys', keys)
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
    return flexes
}

// only from dnames
export async function getTrns(dictkeys, dnames) {
    // dnames = alldnames //  пока что
    let dicts = []
    for (let db of dbs) {
        // if (!dnames.includes(db.dname)) continue
        let docs = await getDB(dictkeys, db)
        docs.forEach(doc=> doc.dname = db.dname)
        // log('_getTrns dname', keys, db.dname, docs.length)
        dicts.push(...docs)
    }
    return dicts
}

export async function getCacheD(keys) {
    log('_cache getting keys', keys)
    let doc = await cacheDdb.allDocs({keys, include_docs: true});
    let rdocs = _.compact(doc.rows.map(row=> row.doc))
    let docs = _.flatten(rdocs.map(rdoc=> rdoc.docs))
    let cached = []
    let nokeys = []

    for (let key of keys) {
        let ok = false
        for (let doc of docs) {
            if (doc.dict == key) cached.push(doc), ok = true
        }
        if (!ok) nokeys.push(key)
    }
    log('_remote_cache cached', cached)
    log('_remote_cache_no_keys', nokeys)

    let cdicts = []
    if (nokeys.length) {
        let iddocs = []
        cdicts = await getCompactedDicts(nokeys)
        // log('_nokeys cdicts:', cdicts)
        let gdict = _.groupBy(cdicts, 'dict')
        for (let dict in gdict) {
            let iddoc = {_id: dict, docs: gdict[dict]}
            iddocs.push(iddoc)
        }

        let pushres = await cacheDdb.bulkDocs(iddocs)
        log('_remote_res:', pushres)
    }

    cdicts.push(...cached)
    log('_remote_cache_iddocs+cached', cdicts.length)
    return cdicts
}

//
export async function getCompactedDicts(dictkeys) {
    let cdicts = []
    for (let db of dbs) {
        let dbdicts = await getDB(dictkeys, db)
        let longgrdicts = _.groupBy(dbdicts, function(o) { return o.rdict + o.pos });
        for (let longkey in longgrdicts) {
            let grdicts = longgrdicts[longkey]
            let probe = grdicts[0]
            let cdict = cdicts.find(cdict=> cdict.pos == probe.pos && cdict.rdict == probe.rdict)
            if (!cdict) {
                cdict = _.clone(probe)
                cdict.trns = []
                cdicts.push(cdict)
            }
            for (let grdict of grdicts) {
                let trn = {dname: grdict.dname, strs: grdict.trns}
                cdict.trns.push(trn)
            }

        }
    }
    // log('_cdicts with combined trns', cdicts)
    return cdicts
}

export async function getIndecls(cwf, dnames) {
    log('______________________________________getIndecls')
    let dicts = []
    for (let db of idbs) {
        // let woiname = db.dname.replace(/^i/, '')
        // if (!dnames.includes(woiname)) continue
        let docs = await getDB([cwf], db)
        docs.forEach(doc=> doc.dname = db.dname)
        dicts.push(...docs)
    }
    return dicts
}

export async function cacheIndecls(cwf, nocache) {
    log('______________________________________cacheIndecls nocache', nocache)
    let dicts = []
    for (let db of idbs) {
        let docs = await getDB([cwf], db)
        docs.forEach(doc=> doc.dname = db.dname)
        dicts.push(...docs)
    }
    return dicts
}

export async function getCacheI(wf) {
    let keys = [wf]
    log('_cache indecl keys', keys)

    let doc = await cacheIdb.allDocs({keys, include_docs: true});
    let rdocs = _.compact(doc.rows.map(row=> row.doc))
    let docs = _.flatten(rdocs.map(rdoc=> rdoc.docs))
    let cached = []
    let nokeys = []

    for (let key of keys) {
        let ok = false
        for (let doc of docs) {
            if (doc.dict == key) cached.push(doc), ok = true
        }
        if (!ok) nokeys.push(key)
    }
    log('_remote_cache_I cached', cached)
    log('_remote_cache_I_no_keys', nokeys)

    let cdicts = []
    if (nokeys.length) {
        let iddocs = []
        cdicts = await getCompactedIndecls(nokeys)
        // log('_nokeys cdicts:', cdicts)
        let gdict = _.groupBy(cdicts, 'dict')
        for (let dict in gdict) {
            let iddoc = {_id: dict, docs: gdict[dict]}
            iddocs.push(iddoc)
        }

        let pushres = await cacheIdb.bulkDocs(iddocs)
        log('_remote_res_I:', pushres)
    }

    cdicts.push(...cached)
    log('_remote_cache_iddocs+cached_I', cdicts.length)
    return cdicts
}

export async function getCompactedIndecls(dictkeys) {
    let cdicts = []
    for (let db of idbs) {
        let dbdicts = await getDB(dictkeys, db)
        let longgrdicts = _.groupBy(dbdicts, function(o) { return o.rdict + o.pos });
        for (let longkey in longgrdicts) {
            let grdicts = longgrdicts[longkey]
            let probe = grdicts[0]
            let cdict = cdicts.find(cdict=> cdict.pos == probe.pos && cdict.rdict == probe.rdict)
            if (!cdict) {
                cdict = _.clone(probe)
                cdict.trns = []
                cdicts.push(cdict)
            }
            for (let grdict of grdicts) {
                let trn = {dname: grdict.dname, strs: grdict.trns}
                cdict.trns.push(trn)
            }

        }
    }
    // log('_cdicts with combined trns', cdicts)
    return cdicts
}
