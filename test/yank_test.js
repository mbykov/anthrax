const log = console.log
import _ from 'lodash'

import { anthrax } from '../index.js'

/* let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός'] */
/* let tests = [  'βούκερας', 'καθαρισμός',] */
let tests = {
    'ἀγαθοποιέω': ['γαθοποι', 'γαθ-ο-ποι'],
    // 'βαρύτονος': ['βαρυτον', 'βαρ-υ-τον'],
    // 'ἄβακος': ['βα'],
    // 'βαρύς': ['βαρ'],
    // 'τόνος': ['τον'],
    // 'ἀγαθός': ['γαθ'],
    // 'στρατηγός': ['στρατηγ', 'στρατ-η-γ'],
    'ἀγγέλλω': ['γγελ'],
    'διαγγέλλω': ['δι-α-γγελ'],
    'ἀναδείκνυμι': ['ἀν-α-δεικν'],
    'ἀποδείκνυμι': ['ἀπ-ο-δεικν'],
    '': [''],
    '': [''],
    '': [''],
}

async function yank(tests) {
    for  (let wf in tests) {
        log('_wf:', wf)
        let chains = await anthrax(wf)
        // log('_chains', chains)
        for (let chain of chains) {
            let str = chain.map(seg=> seg.seg).join('-')
            log('_____res:', str)
        }
    }
}

yank(tests)

// conn: здесь д.б. сложная довольно функция определения соответствия conn и наличия aug во flex-е.
// pref: περισπάω, καθαίρω, παραγράφω, παραβάλλω
// χρονοκρατέω, ἀδικέω
// все случаи:
// aug - ἀδικέω
// aug+pref
// pref - head - conn - tail
// aug - head - conn - tail
