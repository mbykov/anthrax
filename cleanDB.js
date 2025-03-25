//

import _  from 'lodash'
import fse from 'fs-extra'

const log = console.log

fse.emptyDirSync('../pouch-anthrax/cacheI')
fse.emptyDirSync('../pouch-anthrax/cacheA')
fse.emptyDirSync('../pouch-anthrax/cacheD')

log('_empty caches ok')
