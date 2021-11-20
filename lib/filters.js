//

const log = console.log
import _  from 'lodash'
import {oxia, comb, plain, strip} from 'orthos'
import Debug from 'debug'
const f = Debug('dag:filter')

/* dict: ἁρμόζω */
/* ἀναρμόζω (anarmózō) */
/* ἀφαρμόζω (apharmózō) */
/* διαρμόζω (diarmózō) */
/* ἐναρμόζω (enarmózō) */
/* ἐξαρμόζω (exarmózō) */


// // verb or name - ἄβακος, βαίνω, βέβηκα, βιῶ, βίος
export function simple(tail, seg, flex) {
    /* f('_tail-seg', tail, seg._id, flex._id) */
    let chains = []
    for (let doc of seg.docs) {
        let flexes = []
        for (let flexdoc of flex.docs) {
            if (tail != doc.plain + plain(flex._id)) continue
            if (doc.name && flexdoc.name && doc.key == flexdoc.key) flexes.push(flexdoc)
            else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> flexdoc.key == verbkey.key)) flexes.push(flexdoc)
        }
        /* if (flexes.length) f('_= chain =_', doc.rdict) */
        if (flexes.length) chains.push([doc, flexes])
    }
    if (chains.length) return chains
}

// segments - heads из словаря
export function filter(tail, seg, flexes) {
    let chains
    let aug = seg.docs.find(doc=> doc.aug)
    switch(sgms.length) {
        case 2:
            chains = simpleWForm(tail, seg, flexes)
            break
        case 3:
            f('_aug_', aug)
            break
        case 4:
            break
        default:
            break
    }
    return chains
}


// verb or name - γάλα // ἄβακος, βαίνω, βέβηκα,
function simpleWForm(tail, seg, flexes) {
    let chains = []
    for (let doc of seg.docs) {
        f('_rdict', doc.rdict)
        for (let flex of flexes) {
            if (tail != doc.plain + plain(flex._id)) continue
            let cflexes = []
            for (let flexdoc of flex.docs) {
                if (doc.name && flexdoc.name && doc.key == flexdoc.key) cflexes.push(flexdoc)
                else if (doc.verb && flexdoc.verb && doc.keys.find(verbkey=> cflexdoc.key == verbkey.key)) flexes.push(flexdoc)
            }
            if (cflexes.length) chains.push([doc, cflexes])
        }
    }
    if (chains.length) return chains
}



export function filters_ (chain) {
    let pref = chain[0].docs.find(doc=> doc.pref)
    // todo: тут augs, кроме pref
    let cleans = []
    switch(chain.length) {
        case 2:
            for (let doc of chain[0].docs) { // verb or name - ἄβακος, βαίνω, βέβηκα,
                let flexes = []
                if (doc.name) flexes = chain[1].docs.filter(flex=> flex.key == doc.key)
                else if (doc.verb) flexes = chain[1].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                if (flexes.length) cleans.push({doc, flexes})
            }
            /* return cleans */
            break

        case 3:
            if (pref) {
                for (let doc of chain[1].docs) {
                    if (doc.verb && doc.aug == pref.plain) {                                                                                                // simple aug + verb = ἁρμόζω, ἀγαθοεργέω, ἐκγελάω
                        let flexes = chain[2].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                        if (flexes.length) cleans.push({doc, flexes})
                    } else if (doc.name && doc.aug == pref.plain) {
                        let flexes = chain[2].docs.filter(flex=> flex.key == doc.key)
                        if (flexes.length) cleans.push({doc, flexes})
                    } else if (doc.verb) {
                        let flexes = chain[2].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                        if (flexes.length) cleans.push({pref, doc, flexes})
                    } else if (doc.name) {                                                                                                                           //      παραστατικός
                        let flexes = chain[2].docs.filter(flex=> flex.key == doc.key)
                        if (flexes.length) cleans.push({pref, doc, flexes})
                    }
                }
                /* return cleans */
            } else {
                for (let doc of chain[0].docs) { // verb or name
                    if (!doc.verb || !doc.name) continue
                    for (let doc2 of chain[1].docs) {
                        if (!doc.verb && !doc.name) continue
                        let flexes = []
                        if (doc.name) flexes = chain[1].docs.filter(flex=> flex.key == doc.key)
                        else if (doc.verb) flexes = chain[1].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                        if (flexes.length) cleans.push({doc, flexes})
                    }
                }
            }
            break

        case 4:
            // βαρύτονος
            if (pref) {
                log('_4 pref')
            } else {
                log('_4 vowel no pref')
                // βαρύτονος, ὀξύτονος,
                if (chain[1].vowel) {
                    for (let doc of chain[0].docs) { // verb or name
                        if (!doc.verb && !doc.name) continue
                        for (let doc2 of chain[2].docs) {
                            if (!doc.verb && !doc.name) continue
                            let flexes = []
                            if (doc.name) flexes = chain[3].docs.filter(flex=> flex.key == doc2.key)
                            else if (doc.verb) flexes = chain[3].docs.filter(flex=> doc.keys.find(key=> flex.key == key.key))
                            if (flexes.length) cleans.push({doc, doc2, flexes})
                        }
                    }
                }
            }
            break
        default:
            break
    }
    return cleans
}
