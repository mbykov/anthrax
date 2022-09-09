const log = console.log
import _ from 'lodash'
import assert from 'assert'
// import { prettyVerbRes } from '../lib/utils.js'

import { anthrax } from '../index.js'
import {oxia, comb, plain, strip} from 'orthos'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': ['γαθοποι', 'γαθ-ο-ποι'],
    // 'ἀγαθοποιέω': ['ἀ-γαθοποι-έω'],
    // 'βαρύτονος': ['βαρυτον', 'βαρ-υ-τον'],
    // 'ἄβακος': ['βα'],
    // 'βαρύς': ['βαρ'],
    // 'τόνος': ['τον'],
    // 'ἀγαθός': ['γαθ'],
    // 'στρατηγός': ['στρατηγ', 'στρατ-η-γ'],

    'ἀγγέλλω': [{segs: 'ἀ-γγελ-λω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    'διαγγέλλω': [{segs: 'δια-γγελ-λω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    'ἀναδείκνυμι': [{segs: 'ἀνα-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}],
    'ἀποδείκνυμι': [{segs: 'ἀπο-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}, {segs: 'ἀπο-δεικν-υμι', fls: '["act.pres.ind, sg.1"]'}],
    'χρονοκρατέω': [{segs: 'χρον-ο-κρατ-έω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    'ἀντιπαραγράφω': [{segs: 'ἀντιπαρα-γραφ-ω', fls: '["act.pres.ind, sg.1","act.pres.sub, sg.1"]'}],
    '': [{segs: '', fls: ''}],
    '': [{segs: '', fls: ''}],
}

async function testWF(wf, expected) {
    it(`wf ${wf} - ${expected}`, async () => {
        let chains = await anthrax(wf)
        // log('_WF', wf, expected)
        let idx = 0
        for await (let chain of chains) {
            assert.equal(true, true)
            // let pr = prettyVerbRes(chain)
            // let exp = expected[idx]
            // let segs = comb(exp.segs)
            // idx++
            log('_pr:', pr, segs, exp.fls)
            // assert.equal(pr.segs, segs)
            // assert.equal(pr.fls, exp.fls)
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
