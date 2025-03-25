//

import _  from 'lodash'
import path  from 'path'

const currentdir = process.cwd()
const dbpath = path.resolve(currentdir, '../pouch-anthrax')
// log('_dbpath', dbpath)

import { anthrax as index } from './index.js'

import Debug from 'debug'
const cc = Debug('cache')

const log = console.log


/*
  - ищем в cacheA
  - если нет, получаем новый результат из index.js
  - и сохраняем cacheA
  - index имеет кеши Nest, Indecl и Dicts
 */

export async function anthrax(cwf) {
    let keys = [cwf]

    let cached_url = 'http://localhost:5174/grc?wf=' + cwf + '&cache=anthrax'
    let aresp = await fetch(cached_url)
    let cachedocs = await aresp.json()
    log('_FROM anthrax cachedocs', cachedocs)
    // CACHEED !!!!!!!!!!!!!!
    if (cachedocs.length) return cachedocs


    // let idicts = await getCacheI(cwf)
    let indecl_url = 'http://localhost:5174/grc?wf=' + cwf + '&cache=indecl'
    let iresp = await fetch(indecl_url)
    let idicts = await iresp.json()
    log('_FROM anthrax idicts', idicts)

    let conts = await index(cwf, idicts)

    let nestkeys = _.flatten(conts.map(cont=> cont.cdicts.map(cdict=> cdict.dict)))
    nestkeys = _.uniq(nestkeys)

    log('_FROM anthrax nestkeys', nestkeys)

    // let tdicts = await getCacheD(dictkeys)
    let dict_url = 'http://localhost:5174/grc?wf=' + nestkeys + '&cache=dict'
    let dresp = await fetch(dict_url)
    let tdicts = await dresp.json()
    // log('_FROM anthrax tdicts', tdicts)
    let rtdicts = tdicts.map(cdict=> cdict.rdict)
    log('_FROM anthrax rtdicts', rtdicts)

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

    log('____anthrax_conts', conts)
    // log('____anthrax_conts', conts[0].cdicts[0])

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

    // log('____anthrax_conts_+_indecls', conts.length)

    let iddoc = {_id: cwf, docs: conts}

    let post_url = 'http://localhost:5174/grc'
    const response = await fetch(post_url, {
			method: 'POST',
			body: JSON.stringify(iddoc),
			headers: {
				'content-type': 'application/json'
			}
		});

	let postresp = await response.json();
    log('_anhrax.js postresp', postresp)

    // let pushres = await cacheAdb.bulkDocs([iddoc])

    // return []
    return conts
}
