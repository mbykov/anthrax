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
    switch(chain.length) {
        case 2:
            break
        case 3:
            /* log('_case 3', chain[2]) */
            // simple verb + aug
            if (pref) {
                let cleans = []
                for (let doc of chain[1].docs) {
                    if (!doc.verb || doc.aug != pref.plain) continue
                    let flexes = chain[2].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                    cleans.push([pref, doc, flexes])
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
