//

import _ from 'lodash'
import assert from 'assert'
import fse from 'fs-extra'
import path from 'path'

import { anthrax } from '../index.js'

let wordform = process.argv.slice(2)[0] //  'ἀργυρῷ'

const log = console.log

anthrax(wordform)
