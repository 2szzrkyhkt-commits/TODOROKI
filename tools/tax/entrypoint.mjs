import {WorkerEntrypoint} from 'cloudflare:workers';
import taxWorker from './worker.mjs';
import {readPublicLinks} from './public-feed.mjs';
// Bind explicitly to this named entrypoint, never to the default worker.
export class TaxPublicFeed extends WorkerEntrypoint {
 async latest(){
  if(arguments.length)throw new TypeError('latest takes no arguments');
  return readPublicLinks(this.env);
 }
}
// Existing scheduled/default authenticated routes are unchanged.
export default taxWorker;
