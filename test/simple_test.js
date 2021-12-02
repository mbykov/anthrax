const log = console.log
import _ from 'lodash'
import assert from 'assert'

import { anthrax } from '../index.js'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': {size: 2, plains: ['γαθοποι', 'γαθ-ο-ποι'] },
    'βαρύτονος': {size: 2, plains: ['βαρυτον', 'βαρ-υ-τον']},
    'ἄβακος': {size: 1, plains: ['βα'] },
    'βαρύς': {size: 1, plains: ['βαρ', ''] },
    'τόνος': {size: 1, plains: ['τον', ''] },
    'ἀγαθός': {size: 1, plains: ['γαθ', ''] },
    'στρατηγός': {size: 2, plains: ['στρατηγ', 'στρατ-η-γ']},
    '': {size: 2, plains: ['', ''] },
    '': {size: 2, plains: ['', ''] },
    '': {size: 2, plains: ['', ''] },
    '': {size: 2, plains: ['', ''] },
    '': {size: 2, plains: ['', ''] },
}

simpleTest(tests)

async function simpleTest(tests) {
    for  (let wf in tests) {
        if (!wf) continue
        let exp = tests[wf]
        let res = await anthrax(wf)
        assert.equal(exp.size, res.length)
        exp.plains.forEach((plain, idx)=> {
            if (!plain) return
            log('_test:', wf, '=', plain)
            let exstr = res[idx].map(chain=> chain.plain).join('-')
            assert.equal(plain, exstr)
        })
        /* it(' %s %s %s %s ', async (wf, done) => { */
        /* }) */
    }
}
