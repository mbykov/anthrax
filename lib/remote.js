//
import PouchDB from 'pouchdb'
import _  from 'lodash'
import path  from 'path'

const log = console.log
const currentdir = process.cwd()
const dbpath = path.resolve(currentdir, '../pouch-anthrax')
// log('_dbpath', dbpath)

// log('_ANTHRAX REMOTE')
// import { anthrax } from "@mbykov/anthrax"
import { anthrax } from '../index.js'

import Debug from 'debug'
const cc = Debug('cache')


let dbs = []
let idbs = []
let alldnames = ['wkt', 'dvr', 'lsj', 'bbl'] // , 'gram'

let inddb
let flsdb
let nestdb
let cacheDdb // dicts
let cacheIdb // indecls
let cacheAdb // anthrax-nest

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

    const cacheDpath = path.resolve(dbpath, 'cacheD')
    cacheDdb = new PouchDB(cacheDpath)
    cacheDdb.dname = 'cacheD'
    // let keys = ['ἀβουλία']
    // let doc = await cacheDdb.allDocs({keys, include_docs: true});
    // log('_______________________XXXXXXXXXXXXXXXXXXX', doc)

    const nestpath = path.resolve(dbpath, 'nest')
    nestdb = new PouchDB(nestpath)
    nestdb.dname = 'nest'

    const cacheIpath = path.resolve(dbpath, 'cacheI')
    cacheIdb = new PouchDB(cacheIpath)
    cacheIdb.dname = 'cacheI'

    const cacheApath = path.resolve(dbpath, 'cacheA')
    cacheAdb = new PouchDB(cacheApath)
    cacheAdb.dname = 'cacheA'

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
    return cacheAdb
}

export async function getNests(keys) {
    let dicts = await getDB(keys, nestdb)
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

export async function someTest(wf) {
    log('_remote_some_test', wf)
}

export async function someTest1(wf) {
    log('_remote_some_test 1', wf)
}


export async function getTrns(dictkeys, dnames) {
    let dicts = []
    for (let db of dbs) {
        let docs = await getDB(dictkeys, db)
        docs.forEach(doc=> doc.dname = db.dname)
        // log('_get_Trns dname', keys, db.dname, docs.length)
        dicts.push(...docs)
    }
    return dicts
}

export async function cacheAnthrax(cwf) {
    let keys = [cwf]
    let doc = await cacheAdb.allDocs({keys, include_docs: true});
    let rdocs = _.compact(doc.rows.map(row=> row.doc))
    let cachedocs = _.flatten(rdocs.map(rdoc=> rdoc.docs))

    // log('____remote_cachedocs.length', cachedocs.length)

    // CACHEED !!!!!!!!!!!!!!
    if (cachedocs.length) return cachedocs

    let idicts = await getCacheI(cwf)
    // log('____remote_idicts', idicts.length)

    let conts = await anthrax(cwf, idicts.length)

    let dictkeys = _.flatten(conts.map(cont=> cont.cdicts.map(cdict=> cdict.dict)))
    dictkeys = _.uniq(dictkeys)

    let tdicts = await getCacheD(dictkeys)
    let rtdicts = tdicts.map(cdict=> cdict.rdict)

    for (let cont of conts) {
        for (let cdict of cont.cdicts) {
            let tdict = tdicts.find(tdict=> cdict.rdict == tdict.rdict && cdict.pos == tdict.pos)
            if (!tdict) {
                log('_tdict_should_be_always', cdict.rdict)
                throw new Error('ERR: tdict')
            }
            cdict.trns = tdict.trns
            // cdict.show = true
            cdict.cached = true
        }
    }

    log('____remote_conts', conts.length)
    // log('____remote_conts', conts[0].cdicts[0])

    // add indecls
    for (let idict of idicts) {
        let regcont = conts.find(container=> container.cwf == idict.dict)
        if (regcont) {
            regcont.cdicts.push(idict)
        } else {
            if (idict.pos == 'verb' || idict.pos == 'noun' || idict.pos == 'adj' ) idict.pos = 'irreg'
            else idict.pos = 'indecl'
            let icontainer = {indecl: true, cwf, stem: '', rels: [], morels: [], cdicts: [idict]}
            conts.push(icontainer)
        }
    }

    // log('____remote_conts_+_indecls', conts.length)

    let iddoc = {_id: cwf, docs: conts}
    let pushres = await cacheAdb.bulkDocs([iddoc])
    return conts
}

export async function getCacheAdb() {
}

export async function getCacheD(keys) {
    if (!keys.length) return []
    // log('_cache getting keys', keys)
    // log('_cache cacheDdb', cacheDdb.dname)
    // const cacheDpath = path.resolve(dbpath, 'cacheD')
    // cacheDdb = new PouchDB(cacheDpath)
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
    cc('_remote_cache cached', cached)
    cc('_remote_cache_no_keys', nokeys)

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
        cc('_remote_res:', pushres)
    }

    cdicts.push(...cached)
    cc('_remote_cache_iddocs+cached', cdicts.length)
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

export async function getIndecls(cwf) {
    // log('______________________________________getIndecls')
    let dicts = []
    for (let db of idbs) {
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
    cc('_remote_cache_I cached', cached)
    cc('_remote_cache_I_no_keys', nokeys)

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
        cc('_remote_res_I:', pushres)
    }

    cdicts.push(...cached)
    cc('_remote_cache_iddocs+cached_I', cdicts.length)
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
