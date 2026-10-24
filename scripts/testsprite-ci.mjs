import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const PROJECT = 'dafdf75c-04a3-467f-acc2-4359af6b1d8e';
const MANIFEST = 'docs/testsprite/pr5-stored-code-manifest.json';
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

export function verifyRun(expected, result, targetUrl, projectId = PROJECT) {
  requireThat(result?.runId === expected.runId && result.testId === expected.testId, 'Actual run facts do not match the requested test/run pair.');
  requireThat(result.projectId === projectId && result.status === 'passed', `${expected.case}: actual run did not pass in this project.`);
  requireThat(result.source === 'cli', `${expected.case}: this is not the requested CLI replay.`);
  // This backend currently returns codeVersion:null on successful replay. The
  // readback checks before AND after execution prove unchanged hosted source;
  // if a per-run version is supplied, it must also match. Preserve the null in
  // the report rather than manufacturing an individual version attestation.
  requireThat(result.codeVersion == null || result.codeVersion === expected.codeVersion, `${expected.case}: actual run used a different stored version.`);
  requireThat(typeof result.targetUrl === 'string' && canonicalUrl(result.targetUrl) === canonicalUrl(targetUrl), `${expected.case}: actual run used a different preview URL.`);
  requireThat(result.autoHeal !== true, `${expected.case}: the backend enabled auto-heal.`);
  requireThat(result.autoHeal == null || typeof result.autoHeal === 'boolean', `${expected.case}: the backend supplied an unrecognized auto-heal value.`);
  requireThat(result.replay?.path === 'replay' && result.replay.reason === null && result.replay.caveat === null, `${expected.case}: the backend did not confirm unqualified stored-code replay.`);
  return { case: expected.case, testId: result.testId, runId: result.runId, status: result.status,
    reviewedCodeVersion: expected.codeVersion, runCodeVersion: result.codeVersion ?? null,
    autoHeal: result.autoHeal ?? null, autoHealFieldPresent: Object.hasOwn(result, 'autoHeal'),
    replayPath: result.replay.path, replayReason: result.replay.reason, replayCaveat: result.replay.caveat };
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

async function waitForVercel(repository, headSha) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const status = selectVercelStatus(await github(`repos/${repository}/commits/${headSha}/status`), headSha);
    if (status?.state === 'success') return vercelDeploymentId(status);
    requireThat(!['failure', 'error'].includes(status?.state), 'Vercel failed to deploy this exact PR head; no tests were charged.');
    console.log('Waiting for Vercel success on the exact PR head.');
    await new Promise(resolveWait => setTimeout(resolveWait, 10000));
  }
  throw new Error('Vercel did not report success for this PR head; no tests were charged.');
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
    requestedReplay: { requiredCliVersion: '0.15.0', command: 'test run', autoHeal: false, caseCount: 16 },
    attestationLimit: 'Backend null codeVersion and autoHeal values remain null; unqualified replay and unchanged pre/post stored source are verified separately.',
    storedBefore: [], storedAfter: [], runs: [],
  };
  try {
    requireThat(process.env.TESTSPRITE_API_KEY, 'TESTSPRITE_API_KEY repository secret is missing.');
    requireThat(/^[0-9a-f]{40}$/i.test(report.headSha || ''), 'An exact PR head SHA is required.');
    const repository = process.env.GITHUB_REPOSITORY;
    const prNumber = process.env.PR_NUMBER;
    requireThat(repository === 'Davidson3556/Paperwild' && /^\d+$/.test(prNumber || ''), 'A same-repository Paperwild pull request is required.');
    const pr = await github(`repos/${repository}/pulls/${prNumber}`);
    requireThat(pr.head?.repo?.full_name === repository && pr.head.sha === report.headSha && pr.state === 'open', 'This run is not the current open same-repository PR head.');
    const checkout = await execute('git', ['rev-parse', 'HEAD'], { cwd: root });
    requireThat(checkout.stdout.trim() === report.headSha, 'Checkout does not match the exact PR head.');
    const manifest = JSON.parse(await readFile(resolve(root, MANIFEST), 'utf8'));
    const scripts = validateManifest(manifest);
    const targetUrl = previewForBranch(pr.head.ref, manifest.targetUrl);
    const deploymentId = await waitForVercel(repository, report.headSha);
    report.preview = { kind: 'public-branch-alias-with-build-byte-proof', hostname: new URL(targetUrl).hostname, deploymentId };
    report.buildBefore = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl, deploymentId);
    const cliEnv = { ...process.env, GITHUB_ACTIONS: 'false' };
    delete cliEnv.GITHUB_STEP_SUMMARY;
    delete cliEnv.GITHUB_OUTPUT;
    const cli = args => commandJson('testsprite', [...args, '--output', 'json'], cliEnv);
    for (const script of scripts) {
      const stored = await cli(['test', 'code', 'get', script.testId]);
      report.storedBefore.push(verifyStoredCode(script, stored, await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8')));
    }
    console.log('All 16 hosted script bodies match the reviewed source and code versions.');
    const temporary = await mkdtemp(resolve(tmpdir(), 'paperwild-testsprite-'));
    const rawSummary = resolve(temporary, 'summary.json');
    let cliFailure = null;
    try {
      await commandJson('testsprite', ['test', 'run', ...scripts.map(script => script.testId), '--project', PROJECT,
        '--target-url', targetUrl, '--no-auto-heal', '--wait', '--timeout', '600',
        '--report', 'junit', '--report-file', resolve(temporary, 'junit.xml'),
        '--summary-file', rawSummary, '--output', 'json'], cliEnv, 12 * 60 * 1000);
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
    for (const script of scripts) {
      const run = runs.find(row => row.testId === script.testId);
      const actual = await cli(['test', 'wait', run.runId, '--timeout', '30']);
      const verified = verifyRun({ ...script, runId: run.runId }, actual, targetUrl);
      report.runs[report.runs.findIndex(row => row.testId === script.testId)] = verified;
      report.storedAfter.push(verifyStoredCode(script, await cli(['test', 'code', 'get', script.testId]), await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8')));
    }
    const finalPr = await github(`repos/${repository}/pulls/${prNumber}`);
    requireThat(finalPr.head?.sha === report.headSha && finalPr.state === 'open', 'PR head changed while TestSprite was running.');
    const finalDeploymentId = await waitForVercel(repository, report.headSha);
    requireThat(finalDeploymentId === deploymentId, 'Vercel deployment identity changed during strict replay.');
    report.buildAfter = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl, deploymentId);
    const finalHead = await github(`repos/${repository}/pulls/${prNumber}`);
    requireThat(finalHead.head?.sha === report.headSha && finalHead.state === 'open', 'PR head changed during final deployment verification.');
    report.verified = true;
    console.log('Verified: 16/16 exact stored scripts passed; the public preview matched this PR build before and after replay.');
  } catch (error) {
    report.error = error.message;
    process.exitCode = 1;
    console.error(report.error);
  } finally {
    await writeReports(outputDirectory, report);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runGate();
