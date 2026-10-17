// The pure entry: the three shapes an app builds its business guards on, and the guard contract.
// Reading the repository is the `./node` entry's job; running the suite is `./suite`'s.

export {
  declaredLiteral,
  matchPattern,
  ownerOnly,
  reviewedAllowlist,
  sampleHits,
  type AllowlistEntry,
  type Hit,
  type Literal,
  type Matcher,
} from './shapes/shapes.js';
export { formatFindings, type Finding, type Guard, type GuardContext, type Sample } from './guard.js';
export { viewOfText, type FileView } from './reader/view.js';
