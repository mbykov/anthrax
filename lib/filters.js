//

const log = console.log
import _  from 'lodash'


/* dict: ἁρμόζω */
/* ἀναρμόζω (anarmózō) */
/* ἀφαρμόζω (apharmózō) */
/* διαρμόζω (diarmózō) */
/* ἐναρμόζω (enarmózō) */
/* ἐξαρμόζω (exarmózō) */



export function filters (chain) {
    let pref = chain[0].docs.find(doc=> doc.pref)
    /* log('_pref:', pref) */
    let cleans = []
    switch(chain.length) {
        case 2:
            for (let doc of chain[0].docs) {
                let flexes = []
                if (doc.name)  flexes = chain[1].docs.filter(flex=> flex.key == doc.key)
                else if (doc.verb)  flexes = chain[1].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                if (flexes.length) cleans.push({doc, flexes})
            }
            log('_cleans', cleans)
            return cleans
            break
        case 3:
            if (pref) { // simple aug + verb = ἁρμόζω, ἀγαθοεργέω, ἐκγελάω
                for (let doc of chain[1].docs) {
                    if (!doc.verb || doc.aug != pref.plain) continue
                    let flexes = chain[2].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                    if (flexes.length) cleans.push({doc, flexes})
                }
                return cleans
            }
            break
        case 4:
            break
        default:
            break
    }
    return false
}
