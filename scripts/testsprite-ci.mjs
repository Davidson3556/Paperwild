import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { appendFile, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const PROJECT = 'dafdf75c-04a3-467f-acc2-4359af6b1d8e';
const REPOSITORY = 'Davidson3556/Paperwild';
const MANIFEST = 'docs/testsprite/pr5-stored-code-manifest.json';
export const LOCAL_TARGET_URL = 'http://127.0.0.1:4173/';
const EXPECTED_CASES = ['BOAR-001', 'BOAR-002', 'BOAR-003', 'BOAR-004', 'BOAR-005', 'BOAR-006', 'BOAR-007', 'BOAR-008', 'NOTE-001', 'NOTE-002', 'NOTE-003', 'NOTE-004', 'ONBD-001', 'ONBD-002', 'PREF-001', 'SOUN-001'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function validateManifest(manifest) {
  requireThat(manifest?.projectId === PROJECT, 'Stored-code manifest names another project.');
  requireThat(Array.isArray(manifest?.scripts), 'Stored-code manifest is missing scripts.');
  const scripts = manifest.scripts;
  requireThat(scripts.length === EXPECTED_CASES.length, 'The strict suite must contain all 16 reviewed cases.');
  requireThat(new Set(scripts.map(row => row.case)).size === scripts.length, 'Duplicate case in stored-code manifest.');
  requireThat(new Set(scripts.map(row => row.testId)).size === scripts.length, 'Duplicate test ID in stored-code manifest.');
  requireThat([...scripts.map(row => row.case)].sort().join(',') === EXPECTED_CASES.join(','), 'Stored-code manifest does not contain the expected cases.');
  for (const row of scripts) {
    requireThat(/^[0-9a-f-]{36}$/i.test(row.testId), `Invalid test ID for ${row.case}.`);
    requireThat(/^v-[0-9a-f]+$/i.test(row.codeVersion), `Missing reviewed code version for ${row.case}.`);
    requireThat(/^[0-9a-f]{64}$/i.test(row.sha256), `Missing reviewed source hash for ${row.case}.`);
    requireThat(row.readbackEqual === true, `${row.case}: the reviewed manifest has no successful stored-code readback.`);
  }
  return scripts;
}

export function verifyProjectCases(listing, scripts) {
  requireThat(Array.isArray(listing?.items) && listing.nextToken === null, 'The complete project test list could not be verified.');
  requireThat(listing.items.length === scripts.length, 'The project must contain exactly the 16 reviewed tests before using --all.');
  const expected = new Set(scripts.map(row => row.testId));
  const actual = new Set();
  for (const row of listing.items) {
    requireThat(row.projectId === PROJECT && row.type === 'frontend', 'Project test list contains another project or an unexpected test type.');
    requireThat(expected.has(row.id) && !actual.has(row.id), 'Project test list contains an unexpected or duplicate test.');
    actual.add(row.id);
  }
  return { projectId: PROJECT, testIds: [...actual].sort() };
}

export function verifyStoredCode(expected, body, localSource) {
  requireThat(body?.testId === expected.testId, `${expected.case}: stored-code response names another test.`);
  requireThat(body.codeVersion === expected.codeVersion, `${expected.case}: stored code version drifted.`);
  requireThat(typeof body.code === 'string' && !/^https?:\/\//i.test(body.code), `${expected.case}: inline stored source could not be verified.`);
  requireThat(sha256(localSource) === expected.sha256, `${expected.case}: committed source differs from its reviewed manifest.`);
  requireThat(sha256(body.code) === expected.sha256, `${expected.case}: hosted source differs from the reviewed script.`);
  return { case: expected.case, testId: expected.testId, codeVersion: body.codeVersion, sha256: expected.sha256 };
}

export function verifySummary(summary, scripts) {
  requireThat(summary?.total === scripts.length && summary.passed === scripts.length, 'The strict replay did not pass all 16 requested tests.');
  for (const counter of ['failed', 'skipped', 'timedOut']) {
    requireThat(summary[counter] === 0, `Strict replay has ${counter} or is missing that counter.`);
  }
  requireThat(Array.isArray(summary.runs) && summary.runs.length === scripts.length, 'Strict replay has missing or extra run results.');
  const expected = new Set(scripts.map(row => row.testId));
  const ids = new Set();
  const runs = new Set();
  for (const row of summary.runs) {
    requireThat(expected.has(row.testId) && !ids.has(row.testId), 'Strict replay has an unexpected or duplicate test result.');
    requireThat(typeof row.runId === 'string' && row.runId.length > 0 && !runs.has(row.runId), 'Strict replay has a missing or duplicate run ID.');
    requireThat(row.status === 'passed', 'A strict replay result did not pass.');
    ids.add(row.testId);
    runs.add(row.runId);
  }
  return summary.runs;
}

function canonicalUrl(value) {
  const url = new URL(value);
  requireThat(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, 'The preview URL must be a plain HTTPS address.');
  return url.href;
}

/** The CI exception to HTTPS is one literal owned loopback endpoint only. */
export function strictLocalTarget(value) {
  requireThat(value === LOCAL_TARGET_URL || value === LOCAL_TARGET_URL.slice(0, -1),
    'The strict tunnel target must be exactly http://127.0.0.1:4173/.');
  return LOCAL_TARGET_URL;
}

export function targetForPullRequest(pr, headSha, manifestTarget) {
  requireThat(pr?.head?.repo?.full_name === REPOSITORY && pr.head.sha === headSha && pr.state === 'open',
    'This run is not the current open same-repository PR head.');
  // Branch names never choose an address. Every trusted PR gets its own build
  // on the Actions runner; Vercel preview access and settings are independent.
  return strictLocalTarget(manifestTarget);
}

export function verifyCheckoutState(expectedHead, actualHead, porcelainStatus) {
  requireThat(actualHead.trim() === expectedHead, 'Checkout does not match the exact PR head.');
  requireThat(porcelainStatus.trim() === '', 'The checked-out source changed or contains untracked files.');
}

export function verifyRun(expected, result, targetUrl, projectId = PROJECT) {
  requireThat(result?.runId === expected.runId && result.testId === expected.testId, 'Actual run facts do not match the requested test/run pair.');
  requireThat(result.projectId === projectId && result.status === 'passed', `${expected.case}: actual run did not pass in this project.`);
  requireThat(result.source === 'cli', `${expected.case}: this is not the requested CLI replay.`);
  // This backend currently returns codeVersion:null on successful replay. The
  // readback checks before AND after execution prove unchanged hosted source;
  // if a per-run version is supplied, it must also match. Preserve the null in
  // the report rather than manufacturing an individual version attestation.
  requireThat(result.codeVersion == null || result.codeVersion === expected.codeVersion, `${expected.case}: actual run used a different stored version.`);
  const expectedTarget = targetUrl === LOCAL_TARGET_URL || targetUrl === LOCAL_TARGET_URL.slice(0, -1)
    ? strictLocalTarget(targetUrl) : canonicalUrl(targetUrl);
  const actualTarget = expectedTarget === LOCAL_TARGET_URL
    ? strictLocalTarget(result.targetUrl) : canonicalUrl(result.targetUrl);
  requireThat(typeof result.targetUrl === 'string' && actualTarget === expectedTarget, `${expected.case}: actual run used a different preview URL.`);
  requireThat(result.autoHeal !== true, `${expected.case}: the backend enabled auto-heal.`);
  requireThat(result.autoHeal == null || typeof result.autoHeal === 'boolean', `${expected.case}: the backend supplied an unrecognized auto-heal value.`);
  requireThat(result.replay?.path === 'replay' && result.replay.reason === null && result.replay.caveat === null, `${expected.case}: the backend did not confirm unqualified stored-code replay.`);
  if (expected.dispatchedAfter) {
    const started = Date.parse(result.startedAt), finished = Date.parse(result.finishedAt);
    requireThat(Number.isFinite(started) && Number.isFinite(finished)
      && started >= Date.parse(expected.dispatchedAfter) && finished >= started,
    `${expected.case}: actual run timestamps do not belong to this dispatch.`);
  }
  return { case: expected.case, testId: result.testId, runId: result.runId, status: result.status,
    projectId: result.projectId, source: result.source, targetUrl: actualTarget,
    startedAt: result.startedAt ?? null, finishedAt: result.finishedAt ?? null,
    reviewedCodeVersion: expected.codeVersion, runCodeVersion: result.codeVersion ?? null,
    autoHeal: result.autoHeal ?? null, autoHealFieldPresent: Object.hasOwn(result, 'autoHeal'),
    replayPath: result.replay.path, replayReason: result.replay.reason, replayCaveat: result.replay.caveat };
}

export function verifyTunnelReceipt(receipt, runs) {
  requireThat(receipt?.tunnel?.adopted === false && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.tunnel.clientId),
    'The CLI did not attest an owned native tunnel.');
  requireThat(receipt.maxConcurrency === 3 && Array.isArray(receipt.results) && receipt.results.length === runs.length,
    'Native tunnel dispatch receipt is incomplete.');
  const expected = new Map(runs.map(row => [row.testId, row]));
  const seen = new Set();
  for (const row of receipt.results) {
    requireThat(expected.has(row.testId) && !seen.has(row.testId)
      && expected.get(row.testId).runId === row.runId && row.status === 'passed',
    'Native tunnel receipt disagrees with the strict run summary.');
    seen.add(row.testId);
  }
  return { clientId: receipt.tunnel.clientId, owned: true, maxConcurrency: receipt.maxConcurrency };
}

export function selectVercelStatus(combinedStatus, headSha) {
  requireThat(combinedStatus?.sha === headSha, 'GitHub returned status for another commit.');
  requireThat(Array.isArray(combinedStatus.statuses), 'GitHub did not return commit statuses.');
  return combinedStatus.statuses.find(status => status.context === 'Vercel'
    && /^https:\/\/vercel\.com\/davidson3556s-projects\/paperwild\//.test(status.target_url || '')) || null;
}

export function vercelDeploymentId(status) {
  let url;
  try { url = new URL(canonicalUrl(status?.target_url)); } catch { throw new Error('Vercel status has no verifiable deployment identity.'); }
  const path = url.pathname.match(/^\/davidson3556s-projects\/paperwild\/([a-zA-Z0-9]+)$/);
  requireThat(url.hostname === 'vercel.com' && path, 'Vercel status has no verifiable deployment identity.');
  return `dpl_${path[1]}`;
}

export function previewForBranch(branch, manifestTarget) {
  // These scripts and their bundle assertion were reviewed for this exact
  // public feature preview. Other branches need an explicitly reviewed binding.
  requireThat(branch === 'feat/convex-multiplayer', 'This branch has no reviewed TestSprite preview binding; update the stored scripts and binding before testing it.');
  const target = 'https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/';
  requireThat(canonicalUrl(manifestTarget) === target, 'Stored-code manifest names a different preview binding.');
  return target;
}

export function compareBuildFiles(local, remote) {
  requireThat(local.length > 0 && local.some(row => row.path === 'index.html'), 'The local production build is missing index.html.');
  requireThat(new Set(local.map(row => row.path)).size === local.length && remote.length === local.length, 'Production build evidence has missing or duplicate files.');
  const remoteByPath = new Map(remote.map(row => [row.path, row.sha256]));
  requireThat(remoteByPath.size === local.length, 'Remote build evidence has missing or duplicate files.');
  for (const file of local) {
    requireThat(remoteByPath.get(file.path) === file.sha256, `Preview bytes differ from the checked-out build: ${file.path}.`);
  }
  return { fileCount: local.length, treeSha256: sha256([...local].sort((a, b) => a.path.localeCompare(b.path)).map(row => `${row.path}\0${row.sha256}`).join('\n')) };
}

/** Accept only Vercel's one observed, exact appended toolbar tag for this deploy. */
export function verifyPreviewIndex(localBytes, remoteBytes, deploymentId) {
  const local = Buffer.from(localBytes);
  const remote = Buffer.from(remoteBytes);
  const proof = { rawSha256: sha256(remote), normalizedSha256: sha256(local), normalization: 'none', deploymentId };
  if (remote.equals(local)) return proof;
  requireThat(/^dpl_[a-zA-Z0-9]+$/.test(deploymentId || ''), 'Preview HTML has no verified deployment identity.');
  const tag = Buffer.from(`<script async data-explicit-opt-in="true" data-deployment-id="${deploymentId}" src="https://vercel.live/_next-live/feedback/feedback.js"></script>`);
  requireThat(/<\/html>\r?\n?$/.test(local.toString('utf8'))
    && remote.length === local.length + tag.length
    && remote.subarray(0, local.length).equals(local)
    && remote.subarray(local.length).equals(tag), 'Preview index.html differs beyond the exact Vercel feedback tag for this deployment.');
  return { ...proof, normalization: 'one-exact-appended-vercel-feedback-tag' };
}

function safeText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Only our allowlisted fields reach Actions artifacts; never raw CLI/video URLs. */
export async function writeReports(directory, report, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  const rows = report.runs ?? [];
  const failures = rows.filter(row => row.status !== 'passed').length + (report.verified ? 0 : 1);
  const cases = rows.map(row => `    <testcase classname="TestSprite.strict" name="${safeText(row.case)}">${row.status === 'passed' ? '' : `<failure message="${safeText(row.status)}"/>`}</testcase>`);
  if (!report.verified) cases.push(`    <testcase classname="TestSprite.strict" name="Replay contract"><failure message="${safeText(report.error || 'Strict replay was not verified.')}"/></testcase>`);
  await writeFile(resolve(directory, 'junit.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="Paperwild strict TestSprite" tests="${cases.length}" failures="${failures}">\n${cases.join('\n')}\n</testsuite></testsuites>\n`);
  if (summaryPath) {
    await appendFile(summaryPath, `### TestSprite strict replay\n\n${report.verified ? 'Passed: all 16 reviewed scripts completed with strict replay verified.' : `Failed: ${report.error}`}\n\nPR head: \`${report.headSha || 'unverified'}\`\n\n${rows.map(row => `- ${row.case}: ${row.status}`).join('\n')}\n`);
  }
}

async function commandJson(command, args, env = process.env, timeout = 60000) {
  let result;
  try {
    result = await execute(command, args, { env, timeout, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // The underlying output can contain credentials or signed recordings.
    throw new Error(`${command} request failed (exit ${Number.isInteger(error.code) ? error.code : 'unavailable'}); raw output was withheld.`);
  }
  try { return JSON.parse(result.stdout); } catch { throw new Error(`${command} returned an invalid JSON response.`); }
}

async function github(path) {
  return commandJson('gh', ['api', '--method', 'GET', path]);
}

async function checkoutState(root, expectedHead) {
  const [head, status] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd: root }),
    execute('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root }),
  ]);
  verifyCheckoutState(expectedHead, head.stdout, status.stdout);
}

async function buildSnapshot(directory) {
  requireThat((await lstat(directory)).isDirectory(), 'The build directory must be a real directory, not a symlink.');
  const files = new Map();
  async function collect(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await collect(resolve(current, entry.name), `${path}/`);
      else {
        requireThat(entry.isFile(), 'The build contains a symlink or unsupported filesystem entry.');
        files.set(path, await readFile(resolve(current, entry.name)));
      }
    }
  }
  await collect(directory);
  const hashes = [...files].map(([path, bytes]) => ({ path, sha256: sha256(bytes) }));
  return { files, proof: compareBuildFiles(hashes, hashes) };
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

/** No request ever turns into a filesystem path: only exact snapshot keys. */
function requestAsset(rawUrl) {
  const rawPath = rawUrl?.split('?')[0];
  requireThat(typeof rawPath === 'string' && rawPath.startsWith('/') && !rawPath.startsWith('//'), 'Invalid request path.');
  const decoded = decodeURIComponent(rawPath);
  requireThat(!decoded.includes('\\') && !decoded.includes('\0')
    && !decoded.split('/').some(part => part === '.' || part === '..'), 'Unsafe request path.');
  return decoded === '/' ? 'index.html' : decoded.slice(1);
}

/** One owned, loopback-only server; an occupied port is never reused. */
export async function startBuildServer(directory, { port = 4173 } = {}) {
  requireThat(Number.isInteger(port) && port >= 0 && port <= 65535, 'Invalid build-server port.');
  const snapshot = await buildSnapshot(directory);
  const sockets = new Set();
  let closed = false, closing = null, failure = null;
  const server = createServer((request, response) => {
    response.on('error', () => {});
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    let path;
    try { path = requestAsset(request.url); } catch { response.writeHead(400); response.end(); return; }
    const bytes = snapshot.files.get(path);
    if (!bytes) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(path)] || 'application/octet-stream',
      'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((resolveListen, reject) => {
    const failed = error => reject(error);
    server.once('error', failed);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.removeListener('error', failed); resolveListen();
    });
  });
  server.on('error', error => { failure = error; });
  const address = server.address();
  return {
    targetUrl: `http://127.0.0.1:${address.port}/`, initialBuildProof: snapshot.proof,
    get closed() { return closed; },
    async assertUnchanged() {
      requireThat(!closing && !closed && !failure && server.listening, 'The owned build server stopped or failed.');
      const current = await buildSnapshot(directory);
      requireThat(current.proof.fileCount === snapshot.proof.fileCount
        && current.proof.treeSha256 === snapshot.proof.treeSha256, 'The local built files changed during replay.');
      return current.proof;
    },
    async close() {
      if (closing) return closing;
      closing = new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
        .then(() => { closed = true; });
      for (const socket of sockets) socket.destroy();
      await closing;
    },
  };
}

export async function withBuildServer(directory, operation, options) {
  const server = await startBuildServer(directory, options);
  try { return await operation(server); } finally { await server.close(); }
}

export async function verifyPreviewBuild(buildDirectory, targetUrl, deploymentId) {
  const paths = [];
  async function collect(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await collect(resolve(directory, entry.name), `${path}/`);
      else {
        requireThat(entry.isFile(), 'Production build contains an unsupported filesystem entry.');
        paths.push(path);
      }
    }
  }
  await collect(buildDirectory);
  const local = [];
  const remote = [];
  let indexProof;
  let next = 0;
  // Hash every deployed file, including index, worker, art, paper and UI assets.
  // A branch alias is mutable: repeat this proof after replay, and verify that
  // the PR head did not change. Do not call this an immutable deployment.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      const source = await readFile(resolve(buildDirectory, path));
      const response = await fetch(new URL(path, targetUrl), { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
      requireThat(response.status === 200, `Preview file is protected or unavailable: ${path}. Deployment protection was not bypassed.`);
      const remoteBytes = Buffer.from(await response.arrayBuffer());
      local.push({ path, sha256: sha256(source) });
      if (path === 'index.html') {
        indexProof = verifyPreviewIndex(source, remoteBytes, deploymentId);
        remote.push({ path, sha256: indexProof.normalizedSha256 });
      } else remote.push({ path, sha256: sha256(remoteBytes) });
    }
  }));
  return { ...compareBuildFiles(local, remote), index: indexProof };
}

export async function runGate() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = resolve(root, 'testsprite-ci-results');
  const report = {
    verified: false, headSha: process.env.PR_HEAD_SHA || null,
    requestedReplay: { requiredCliVersion: '0.15.0', command: 'test run --local', autoHeal: false, caseCount: 16, maxConcurrency: 3 },
    attestationLimit: 'Backend null codeVersion and autoHeal values remain null; unqualified replay and unchanged pre/post stored source are verified separately.',
    storedBefore: [], storedAfter: [], runs: [],
  };
  let ownedServer;
  try {
    requireThat(process.env.TESTSPRITE_API_KEY, 'TESTSPRITE_API_KEY repository secret is missing.');
    requireThat(/^[0-9a-f]{40}$/i.test(report.headSha || ''), 'An exact PR head SHA is required.');
    const repository = process.env.GITHUB_REPOSITORY;
    const prNumber = process.env.PR_NUMBER;
    requireThat(repository === REPOSITORY && /^\d+$/.test(prNumber || ''), 'A same-repository Paperwild pull request is required.');
    const pr = await github(`repos/${repository}/pulls/${prNumber}`);
    await checkoutState(root, report.headSha);
    const manifest = JSON.parse(await readFile(resolve(root, MANIFEST), 'utf8'));
    const scripts = validateManifest(manifest);
    const targetUrl = targetForPullRequest(pr, report.headSha, manifest.targetUrl);
    requireThat(manifest.convexUrl === 'https://fast-starling-207.convex.cloud'
      && process.env.VITE_CONVEX_URL === manifest.convexUrl,
      'Strict build must use the reviewed public Convex development URL.');
    report.buildEnvironment = { publicConvexUrl: manifest.convexUrl };
    const cliEnv = { ...process.env, GITHUB_ACTIONS: 'false' };
    delete cliEnv.GITHUB_STEP_SUMMARY;
    delete cliEnv.GITHUB_OUTPUT;
    const cli = args => commandJson('testsprite', [...args, '--output', 'json'], cliEnv);

    await withBuildServer(resolve(root, 'dist'), async server => {
      ownedServer = server;
      requireThat(server.targetUrl === targetUrl, 'The owned build server did not bind the exact strict target.');
      report.preview = { kind: 'owned-loopback-build-through-native-testsprite-tunnel', targetUrl, branch: pr.head.ref };
      report.buildBefore = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl);
      requireThat(report.buildBefore.treeSha256 === server.initialBuildProof.treeSha256, 'The served build changed before dispatch.');
      await server.assertUnchanged();
      report.projectBefore = verifyProjectCases(await cli(['test', 'list', '--project', PROJECT]), scripts);
      for (const script of scripts) {
        const stored = await cli(['test', 'code', 'get', script.testId]);
        requireThat(stored.language === 'python', `${script.case}: hosted source is not Python.`);
        report.storedBefore.push(verifyStoredCode(script, stored, await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8')));
      }
      targetForPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha, manifest.targetUrl);
      await checkoutState(root, report.headSha);
      await server.assertUnchanged();
      console.log('All 16 hosted scripts match the reviewed source; the owned exact-PR build is ready.');
      const temporary = await mkdtemp(resolve(tmpdir(), 'paperwild-testsprite-'));
      const rawSummary = resolve(temporary, 'summary.json');
      const dispatchedAfter = new Date().toISOString();
      report.dispatchedAfter = dispatchedAfter;
      let replayFailure = null;
      try {
        let receipt, cliFailure = null;
        try {
          receipt = await commandJson('testsprite', ['test', 'run', '--all', '--project', PROJECT,
            '--local', '4173', '--local-host', '127.0.0.1', '--max-concurrency', '3',
            '--no-auto-heal', '--wait', '--timeout', '1200',
            '--report', 'junit', '--report-file', resolve(temporary, 'junit.xml'),
            '--summary-file', rawSummary, '--output', 'json'], cliEnv, 40 * 60 * 1000);
        } catch (error) { cliFailure = error; }
        let summary;
        try { summary = JSON.parse(await readFile(rawSummary, 'utf8')); } catch { throw cliFailure || new Error('Strict replay did not produce a summary.'); }
        const publicStatuses = new Set(['passed', 'failed', 'blocked', 'skipped', 'timeout', 'cancelled', 'error', 'queued', 'running', 'not_found']);
        report.runs = scripts.map(script => {
          const status = summary.runs?.find(row => row.testId === script.testId)?.status;
          return { case: script.case, testId: script.testId, status: publicStatuses.has(status) ? status : 'missing-or-unknown' };
        });
        const runs = verifySummary(summary, scripts);
        if (cliFailure) throw cliFailure;
        report.tunnel = verifyTunnelReceipt(receipt, runs);
        for (const script of scripts) {
          const run = runs.find(row => row.testId === script.testId);
          const actual = await cli(['test', 'wait', run.runId, '--timeout', '30']);
          report.runs[report.runs.findIndex(row => row.testId === script.testId)] =
            verifyRun({ ...script, runId: run.runId, dispatchedAfter }, actual, targetUrl);
        }
      } catch (error) { replayFailure = error; }

      // A failed or incomplete replay still gets a read-only postflight audit.
      // Neither an audit nor an error path dispatches another test or heals code.
      try {
        for (const script of scripts) {
          const stored = await cli(['test', 'code', 'get', script.testId]);
          requireThat(stored.language === 'python', `${script.case}: hosted source is not Python.`);
          report.storedAfter.push(verifyStoredCode(script, stored, await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8')));
        }
        report.projectAfter = verifyProjectCases(await cli(['test', 'list', '--project', PROJECT]), scripts);
        targetForPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha, manifest.targetUrl);
        await checkoutState(root, report.headSha);
        await server.assertUnchanged();
        report.buildAfter = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl);
        requireThat(report.buildAfter.fileCount === report.buildBefore.fileCount
          && report.buildAfter.treeSha256 === report.buildBefore.treeSha256, 'The exact PR build changed during replay.');
        await server.assertUnchanged();
        targetForPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha, manifest.targetUrl);
        await checkoutState(root, report.headSha);
        report.postRunAuditCompleted = true;
      } catch (error) {
        report.postRunAuditError = error.message;
        replayFailure ??= error;
      }
      if (replayFailure) throw replayFailure;
    });
    report.verified = true;
    console.log('Verified: 16/16 exact stored scripts passed against the owned PR build; all served files matched before and after replay.');
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
    console.error(report.error);
  } finally {
    report.ownedServerClosed = ownedServer?.closed ?? null;
    await writeReports(outputDirectory, report);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runGate();
