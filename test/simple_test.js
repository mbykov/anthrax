const log = console.log
import _ from 'lodash'
import assert from 'assert'

import { anthrax } from '../index.js'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': ['γαθοποι', 'γαθ-ο-ποι'],
    'βαρύτονος': ['βαρυτον', 'βαρ-υ-τον'],
    'ἄβακος': ['βα'],
    'βαρύς': ['βαρ'],
    'τόνος': ['τον'],
    'ἀγαθός': ['γαθ'],
    'στρατηγός': ['στρατηγ', 'στρατ-η-γ'],
    '': [''],
    '': [''],
    '': [''],
    '': [''],
    '': [''],
}

simpleTest(tests)

async function simpleTest(tests) {
    for  (let wf in tests) {
        if (!wf) continue
        let exp = tests[wf]
        let res = await anthrax(wf)
        assert.equal(exp.length, res.length)
        exp.forEach((plain, idx)=> {
            if (!plain) return
            log('_test:', wf, '=', plain)
            let exstr = res[idx].map(chain=> chain.plain).join('-')
            assert.equal(plain, exstr)
        })
    }
}
