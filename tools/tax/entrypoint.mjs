import {WorkerEntrypoint} from 'cloudflare:workers';
import taxWorker from './worker.mjs';
import {readPublicCatalog} from './public-catalog.mjs';

export class TaxPublicFeed extends WorkerEntrypoint {
  async catalog() {
    if (arguments.length) throw new TypeError('catalog takes no arguments');
    return readPublicCatalog(this.env.TAX);
  }
}

export default taxWorker;
