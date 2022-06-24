const log = console.log
import _ from 'lodash'
import assert from 'assert'

import { anthrax } from '../index.js'
import {oxia, comb, plain, strip} from 'orthos'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    // 'ἀγαθοποιέω': ['γαθοποι', 'γαθ-ο-ποι'],
    'ἀγαθοποιέω': ['ἀ-γαθοποι-έω'],
    // 'βαρύτονος': ['βαρυτον', 'βαρ-υ-τον'],
    // 'ἄβακος': ['βα'],
    // 'βαρύς': ['βαρ'],
    // 'τόνος': ['τον'],
    // 'ἀγαθός': ['γαθ'],
    // 'στρατηγός': ['στρατηγ', 'στρατ-η-γ'],
    'ἀγγέλλω': ['ἀ-γγελ-λω'],
    'διαγγέλλω': ['δια-γγελ-λω'],
    'ἀναδείκνυμι': ['ἀνα-δεικν-υμι'],
    'ἀποδείκνυμι': ['ἀπο-δεικν-υμι'],
    '': [''],
    '': [''],
    '': [''],
}

async function testWF(wf, exp) {
    it(`wf ${wf} - ${wf.form}`, async () => {
        let result = await anthrax(wf)
        assert.equal(result.length, exp.length)
        exp.forEach((plain, idx)=> {
            if (!plain) return
            let rstring = result[idx].map(seg=> seg.seg).join('-')
            plain = comb(plain)
            // log('_P', plain, 'R', rstring)
            assert.equal(plain, rstring)
        })
    })
}

describe('simple test', () => {
    for (let test in tests) {
        if (!test) continue
        let expected = tests[test]
        testWF(test, expected)
    }
})


/* simpleTest(tests) */
/* async function simpleTest(tests) {
 *     for  (let wf in tests) {
 *         if (!wf) continue
 *         let exp = tests[wf]
 *         let res = await anthrax(wf)
 *         assert.equal(exp.length, res.length)
 *         exp.forEach((plain, idx)=> {
 *             if (!plain) return
 *             log('_test:', wf, '=', plain)
 *             let exstr = res[idx].map(chain=> chain.plain).join('-')
 *             assert.equal(plain, exstr)
 *         })
 *     }
 * } */
