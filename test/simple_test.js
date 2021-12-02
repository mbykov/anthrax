const log = console.log
import _ from 'lodash'
import assert from 'assert'

import { anthrax } from '../index.js'

let tests = ['ἀγαθοποιέω', 'βαρύτονος', 'ἄβακος', 'βαρύς', 'τόνος', 'ἀγαθός',   'στρατηγός']
/* let tests = [  'βούκερας', 'καθαρισμός',] */

simpleTest()

async function simpleTest() {
    for await (let test of tests) {
        let res = await anthrax(test)
        log('_T', test)
        log('_R', res)
    }
}
