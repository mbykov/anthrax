const log = console.log
import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'

import { anthrax } from '../index.js'

const text = fse.readFileSync('./test/morph-data/compound-prefix.txt','utf8')
const rows = text.split('\n')

log('_PREF-ROWS', rows.slice(0,8))
