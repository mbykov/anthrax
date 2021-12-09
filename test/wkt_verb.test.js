//

const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'
import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'
import { makeVerbTests } from './lib/makeVerbTests.js'

import { anthrax } from '../index.js'
import Debug from 'debug'

const d = Debug('test')

let skip = true

const text = fse.readFileSync('./test/morph-data/wkt_verb.txt','utf8')
let rows = _.compact(text.split('\n'))

log('_ROWS', rows.length)

rows = rows.slice(0, 500)
let tests = makeVerbTests(rows)

tests = tests.slice(0, 20)
log('T', tests)
