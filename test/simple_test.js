const log = console.log
import _ from 'lodash'
import assert from 'assert'
// import { prettyVerbRes } from '../lib/utils.js'

import { anthrax } from '../index.js'
import {oxia, comb, plain, strip} from 'orthos'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': ['ἀ-γαθοποι-έω', 'ἀ-γαθ-ο-ποι-έω'],
    'βαρύτονος': ['βαρυτον-ος', 'βαρ-υ-τον-ος'],
    'ἄβακος': ['ἀ-β-ακος'],
    // 'βαρύς': ['βαρ'],
    // 'τόνος': ['τον'],
    // 'ἀγαθός': ['γαθ'],
    // 'στρατηγός': ['στρατηγ', 'στρατ-η-γ'],

    // 'ἀγγέλλω': [{segs: 'ἀ-γγελ-λω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    // 'διαγγέλλω': [{segs: 'δια-γγελ-λω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    // 'ἀναδείκνυμι': [{segs: 'ἀνα-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}],
    // 'ἀποδείκνυμι': [{segs: 'ἀπο-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}, {segs: 'ἀπο-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}],
    // 'χρονοκρατέω': [{segs: 'χρον-ο-κρατ-έω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    // 'ἀντιπαραγράφω': [{segs: 'ἀντιπαρα-γραφ-ω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
}

async function testWF(wf, expected) {
    it(`wf ${wf} - ${expected}`, async () => {
        let chains = await anthrax(wf)
        let idx = 0
        for await (let chain of chains) {
            let segs = chain.map(seg=> seg.seg).join('-')
            let exp = expected[idx]
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
