//

import { getStress, stresses, vowels } from './utils.js'

const log = console.log

// import { enclitics  } from './encs.js'
import {oxia, comb, plain, strip} from 'orthos'
import { encs  } from './encs-list.js'

export function enclitic(wf) {
    // let cwf = oxia(comb(wf).toLowerCase())
    let cwf = comb(wf)

    // if (enclitics[cwf]) cwf = enclitics[cwf]
    // TODO: отбросить второе острое ударение
    // TODO: есть Esti(n) с ударением на первой букве - добавить вручную?

    let count = counterStress(cwf)
    log('_count', count)

    if (count == 2) cwf = removeLastStress(cwf)

    return cwf
}

function counterStress(wf) {
    let count = 0
    for (let sym of wf.split('')) {
        if (stresses.includes(sym)) count++
    }
    return count
}

function removeLastStress(cwf) {
    let csyms = []
    let ok = true
    for (let sym of cwf.split('')) {
        if (stresses.includes(sym) && !ok) continue
        if (stresses.includes(sym)) ok = false
        csyms.push(sym)
    }
    return csyms.join('')
}
