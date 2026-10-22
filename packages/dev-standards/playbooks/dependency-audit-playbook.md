# Dependency Audit Playbook

## Purpose

One AI-run audit of dependencies across every install root an app has — the web app, Cloud
Functions, any other deployed tree, tests, and tooling — and the `@ttt-productions/*` packages it
installs: security advisories, version drift, non-reproducible builds, licensing exposure, and risky
upgrades. It verifies the package boundary rules (RULE-STD-ARCH-202, RULE-STD-ARCH-203) and the
packages-first workflow (RULE-STD-ARCH-205), including that the server-only Functions install never
acquires a client peer. Methodology only; the per-step contract, boundary, and verdict are
[README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc, and NOT a findings log. It owns the published-vs-declared
registry comparison that `codebase-hygiene-playbook.md` step 16 defers here under authorization.

**Boundary notes.** Every registry query (`npm audit`, `npm ci`, a published-version lookup) leaves
the local boundary and runs only under DJ's authorization; until then it is `BLOCKED`.

## When to run

Before launch; before and after a dependency upgrade; after a package adoption; when a gate's audit
stage goes red.

## Audit Steps

### 1. Enumerate package roots (local)
**Rules:** RULE-STD-ARCH-205, RULE-STD-ARCH-101. **Scope:** every npm install root and its lockfile,
plus installed `node_modules/@ttt-productions/*`. **Method (discovery — feeds steps 3–5).**
```bash
# Enumerate the install roots from the lockfiles themselves — never from a hand-kept list.
git ls-files '*package-lock.json' | rg -v node_modules
```
**Expected:** the command enumerates the install roots; a root appearing or disappearing without a
matching manifest change is itself the finding. For each root, map its declared `@ttt-productions/*`
dependencies. Discovery, not pass/fail. Every root is judged by a later step (the app's additions
name any root a separate step owns); a root no step judges is a scope hole.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Vulnerability audit (registry — authorization required)
**Rules:** no dedicated rule — dependency-security posture is owned by this playbook. **Scope:** every
install root; queries the npm advisory registry. **Method (BLOCKED by default).**
Under DJ's explicit authorization, run `npm audit --omit=dev` in each root (each in its own subshell).
**Expected:** every production advisory is addressed or accepted with a written rationale; a dev-only
finding is judged against whether the CI, build, or deploy pipeline executes it. **Every advisory left
unresolved carries a written exploitability note for this codebase plus a mitigation or upgrade
plan**; an exploitable unmitigated advisory, or one with no written triage, is the finding.

**Remediation is per tree, and `npm update` is not the tool.** Run `npm audit fix` in every tree the
gate audits — a remediation that names only the root leaves the gate red. For a leftover set of
packages that depend on each other, `npm update <pkg>` can report "up to date" and change nothing;
the fix is an explicit pinned install in each affected tree, naming only the packages that tree
declares (a transitive package follows automatically) and leaving the caret ranges standing. Re-run
`npm audit` in every tree and require zero before calling the remediation done; a test-runner bump
that changes test behavior is a finding to investigate, never something to absorb.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Reproducibility: declared vs lock vs installed
**Rules:** RULE-STD-ARCH-205, RULE-STD-QUALITY-008. **Scope:** each primary root's manifest, lockfile,
and installed tree (local); the `npm ci` half is registry.
```bash
# LOCAL: does the installed tree come from the committed lockfile? Roots: edit to the repo's own.
node -e '
const fs=require("fs"),p=require("path");
for (const root of [".","functions"]) {
  const man=JSON.parse(fs.readFileSync(p.join(root,"package.json"),"utf8"));
  const lock=JSON.parse(fs.readFileSync(p.join(root,"package-lock.json"),"utf8"));
  const deps={...man.dependencies,...man.devDependencies};
  for (const [name,range] of Object.entries(deps)) {
    const locked=(lock.packages||{})["node_modules/"+name]?.version;
    let installed;try{installed=JSON.parse(fs.readFileSync(p.join(root,"node_modules",name,"package.json"),"utf8")).version}catch{installed=null}
    if (locked!==installed) console.log(`${root}: ${name}  declared ${range} | lock ${locked} | installed ${installed}`);
  }
}'
```
**Expected:** prints nothing — every declared dependency's installed version equals its locked
version, so a local green gate is evidence about the tree CI builds. A printed row is classified: an
installed version outside its declared range cannot have come from the current manifest (a real
non-reproducible build — DJ reruns `npm ci`, his call); one inside range but behind the lock is
stale-install drift. A publisher's own version string that prints while resolving correctly is a
known non-finding the app's additions name. `npm ci` reaches the registry and runs only under DJ's
authorization. The full gate is RULE-STD-QUALITY-002's and is not re-run here.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Version alignment (local manifests)
**Rules:** RULE-STD-ARCH-205, RULE-STD-ARCH-101. **Scope:** local manifests + installed
`node_modules` metadata. **Method (local comparison — mirrors `codebase-hygiene-playbook.md` step 16).**
```bash
rg -n '"(firebase|firebase-admin|firebase-functions|next|react|react-dom|@sentry/[^"]*|typescript|vitest|@playwright/test)"' package.json functions/package.json
```
**Expected:** the platform, framework, monitoring, language, and test dependencies are mutually
compatible, and each declared `@ttt-productions/*` version equals the installed package's
`package.json` and the lockfile — a local comparison only. A published-vs-declared comparison is
step 5 under authorization.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Shared-package drift
**Rules:** RULE-STD-ARCH-205, RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-ARCH-204. **Scope:** `src`
+ `functions/src` imports vs installed packages; the published-vs-declared half is registry.
```bash
# Which packages each tree imports, as counts. Colocated tests are excluded by glob.
rg -o "@ttt-productions/[a-z-]+" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx' --no-filename | sort | uniq -c | sort -rn
rg -o "@ttt-productions/[a-z-]+" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' --no-filename | sort | uniq -c | sort -rn
```
**Expected:** the pass condition is derived, not enumerated: **every package the `src` summary prints
is declared in the root `package.json`, and every package the `functions/src` summary prints is
declared in `functions/package.json`** — an imported package absent from its tree's manifest resolves
only by hoisting, and a clean install can drop it. The counts carry no baseline. A truncated token with
no declaration is a wrapped comment, not an import — confirm with a raw `rg -n` before filing it. A
package update that changed a path or type helper is reflected everywhere it is used with the
call-site shape held (RULE-STD-ARCH-204). **Under DJ's authorization only**, the published-vs-declared
comparison runs here.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Unused or risky production dependencies
**Rules:** RULE-STD-BACKEND-307; no dedicated rule for third-party supply-chain risk. **Scope:** every
root's production dependencies. **Method (semantic review + lifecycle-script search).**
```bash
rg -n '"(preinstall|install|postinstall|prepare)"\s*:' package.json functions/package.json
```
**Expected:** no unexpected install or build lifecycle script; a dependency that runs in production,
handles secrets, or adds server attack surface goes through its one app adapter and reads secrets from
the secret manager. A production dependency with an unreviewed `postinstall` or raw secret access is a
finding to bring to DJ.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Lockfile consistency (local)
**Rules:** RULE-STD-ARCH-205. **Scope:** every root's lockfile.
```bash
rg -n '"lockfileVersion"' package-lock.json functions/package-lock.json
git status --porcelain package-lock.json functions/package-lock.json
# The package-manager probe — neither command above can see a non-npm lockfile:
find . -maxdepth 2 \( -name yarn.lock -o -name pnpm-lock.yaml -o -name bun.lockb \) -not -path './node_modules/*'
```
**Expected:** every lockfile is committed and matches its root; an uncommitted or drifted lockfile is
a FAIL (a local-vs-deploy mismatch). The probe prints nothing: npm is the only package manager, and a
non-npm lockfile anywhere is the drift finding. `git status` only reads — DJ owns every git action.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Deployment runtime supports installed dependencies
**Rules:** no dedicated rule — the owning references are the app's Functions architecture and release
pipeline design docs. **Scope:** the manifests' `engines`, the Node version file, the CI workflows, and
the hosting configuration (local files). **Method (guard tests + semantic review).**
```bash
rg -n '"node"|"engines"' functions/package.json package.json
```
**Expected:** every manifest declares one Node major, and the app's CI guard proves the Node version
file, every `engines.node`, and every CI setup step name that same major (the app's additions name the
guard). The deployed runtime of every Functions codebase and every hosting backend supports every
installed dependency; a dependency requiring a newer runtime than the declared `engines.node` is a
FAIL. Confirming a runtime set in a hosted console is hosted state, `BLOCKED` until authorized.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. The server-only Functions install stays client-free
**Rules:** RULE-STD-ARCH-202, RULE-STD-ARCH-203. **Scope:** the `functions` install and its lockfile.
**Method (the app's server-clean check, named in its additions).**
**Expected:** the Functions lockfile contains no `react`, `react-dom`, `@tanstack/react-query`, client
`firebase` SDK, or React-only `@ttt-productions/*` package (the server SDKs are expected). A hit means a
package declared a client peer as required, so npm installed it into the server tree — mark that peer
`optional` in ttt-packages, publish, then clean-reinstall Functions. The runtime half (importing a
package root that loads React) is `react-leak-audit-playbook.md`.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 13. Production dependency licensing (local)
**Rules:** no dedicated rule — supply-chain licensing is owned by this playbook; cross-ref
RULE-STD-ARCH-202 (which tree a package ships into). **Scope:** the installed production trees of the
primary roots. **Method (local by construction — reads installed `package.json` files).**
```bash
for root in . functions; do echo "=== $root ==="; (cd "$root" && npm ls --omit=dev --all --parseable 2>/dev/null | node -e '
const fs=require("fs"),p=require("path");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
const ALLOW=new Set(["MIT","ISC","Apache-2.0","BSD-2-Clause","BSD-3-Clause","0BSD","CC0-1.0","Unlicense","BlueOak-1.0.0","MIT-0","Python-2.0","CC-BY-4.0"]);
const flagged=[];let n=0;
for(const dir of new Set(d.split("\n").map(s=>s.trim()).filter(Boolean))){let j;try{j=JSON.parse(fs.readFileSync(p.join(dir,"package.json"),"utf8"))}catch{continue}
const l=typeof j.license==="string"?j.license:(j.license&&j.license.type)||(Array.isArray(j.licenses)&&j.licenses.map(x=>x.type).join(" OR "))||"UNKNOWN";n++;
if(!ALLOW.has(l))flagged.push(j.name+"@"+j.version+"  "+l);}
console.log("packages:",n);console.log(flagged.length?flagged.join("\n"):"(no license outside the allowlist)");});'); done
```
**Expected:** the allowlist is the permissive set in the command itself; the pass condition is that
every flagged row is classified, not that the list is empty. A copyleft license (GPL, AGPL, LGPL, MPL,
SSPL, EPL) reaching the shipped client bundle or the Functions image needs DJ's decision; a compound
expression with a permissive branch is fine once the branch is named; `UNKNOWN` on a tree root is the
repo's own manifest. `UNKNOWN` on a real dependency means no `license` field — read its `LICENSE`
before classifying. The classified set is the app's addition, re-classified on any change.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **FAIL** — a critical exploitable dependency remains, a build is
non-reproducible, or shared-package drift can break a runtime path or type.
