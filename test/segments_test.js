const log = console.log
import _ from 'lodash'
import assert from 'assert'

import { anthrax } from '../index.js'
import {oxia, comb, plain, strip} from 'orthos'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': ['ἀ-γαθοποι-έω', 'ἀ-γαθ-ο-ποι-έω'],
    'βαρύτονος': ['βαρυτον-ος', 'βαρ-υ-τον-ος'],
    'ἄβακος': ['ἀ-β-ακος'],
    'γράφω': ['γραφ-ω'],
    'παραγράφω': ['παραγραφ-ω', 'παρ-α-γραφ-ω'],
    'ἀντιπαραγράφω': ['ἀντ-ι-παραγραφ-ω', 'ἀντ-ι-παρ-α-γραφ-ω'],
    'ἐγγίζω': ['ἐ-γγιζ-ω'],
    'ἀγγέλλω': ['ἀ-γγελλ-ω'],
    'διαγγέλλω': ['διαγγελλ-ω', 'δι-α-γγελλ-ω'],
    'αἱρέω': ['αἱ-ρ-έω', 'αἱ-ρ-έω'], // αἱρέω, αἴρω - is second correct?
    'συγκαθαιρέω': ['συγ-καθαιρ-έω', 'συγ-καθ-αι-ρ-έω', 'συγ-καθ-αι-ρ-έω'],
    'δείκνυμι': ['δεικνυ-μι'],
    'ἀποδείκνυμι': ['ἀ-ποδεικνυ-μι', 'ἀπ-ο-δεικνυ-μι'],
    'χρονοκρατέω': ['χρον-ο-κρατ-έω'],
    'προσαπαγγέλλω': ['προσαπαγγελλ-ω', 'προσ-απ-α-γγελλ-ω'],
    'ἐπεξήγησις': ['ἐ-πεξηγησ-ις'],
    '': ['', ''],
    '': ['', ''],
    '': ['', ''],
}

async function testWF(wf, expected) {
    it(`wf ${wf} - ${expected}`, async () => {
        if (!wf) return
        let chains = await anthrax(wf)
        let idx = 0
        for await (let exp of expected) {
            let chain = chains[idx]
            let segs = chain.map(seg=> seg.seg).join('-')
            // log('_WF', wf, exp, segs)
            assert.equal(exp, segs)
            idx++
        }
    })
}

describe('simple test', () => {
    for (let test in tests) {
        if (!test) continue
        let expected = tests[test]
        testWF(test, expected)
    }
})
