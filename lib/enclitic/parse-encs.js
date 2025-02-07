const log = console.log
import _ from 'lodash'
import fse from 'fs-extra'
import path from 'path'
// import { dirname } from 'path';
import {oxia, comb, plain, strip} from 'orthos'

import { encs  } from './enclitics-list.js'

let enclitics = {}

for (let wf of encs) {
    let cwf = comb(wf)
    let pwf = plain(cwf)
    enclitics[pwf] = cwf
}

 fse.writeFileSync('./lib/enclitics.js', toConst(enclitics, 'enclitics'))

export function toConst(obj, name) {
    return ['export const ', name, ' = ', JSON.stringify(obj, null, 8)].join('')
}
