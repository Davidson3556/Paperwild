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
const CLI_ERROR_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR',
  'PAYLOAD_TOO_LARGE', 'CONFLICT', 'PRECONDITION_FAILED', 'IDEMPOTENCY_BODY_MISMATCH', 'RATE_LIMITED',
  'INSUFFICIENT_CREDITS', 'FEATURE_GATED', 'AMBIGUOUS_ORG', 'UNSUPPORTED', 'CLIENT_TOO_OLD', 'INTERNAL', 'UNAVAILABLE']);
const RUN_STATUSES = new Set(['passed', 'failed', 'blocked', 'skipped', 'timeout', 'cancelled', 'error', 'queued', 'running', 'not_found']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PUBLIC_CI = Object.freeze({
  projectId: 'prj_K4XUFAg81KYU0YxfC0ISyU3JRhox', projectName: 'paperwild-ci',
  teamSlug: 'davidson3556s-projects', hostnamePrefixes: ['paperwild-ci-', 'paperwild-'],
  hostnameSuffix: '-davidson3556s-projects.vercel.app',
  githubBotId: 35613825, githubAppId: 8329,
  // Only an actually observed environment is accepted. A new environment must
  // be checked against its real GitHub record before this list is extended.
  environments: ['Production – paperwild-ci', 'Preview – paperwild-ci'],
});
export const TARGET_PLACEHOLDER = '__PAPERWILD_CI_TARGET_URL__';
const TARGET_LINE = /^TARGET = ("[^\r\n]*")$/gm;

/** The only permitted transport edit is one canonical top-level TARGET line. */
export function normalizeTargetSource(source, { template = false } = {}) {
  requireThat(typeof source === 'string', 'Stored Python source is missing.');
  const assignments = [...source.matchAll(/^TARGET\s*=/gm)];
  const matches = [...source.matchAll(TARGET_LINE)];
  requireThat(assignments.length === 1 && matches.length === 1, 'Python must contain exactly one canonical TARGET assignment.');
  let literal;
  try { literal = JSON.parse(matches[0][1]); } catch { throw new Error('Python TARGET is not a canonical string literal.'); }
  requireThat(typeof literal === 'string' && matches[0][1] === JSON.stringify(literal), 'Python TARGET is not a canonical string literal.');
  if (template) requireThat(literal === TARGET_PLACEHOLDER, 'Committed Python must use the fail-closed target placeholder.');
  else {
    requireThat(literal !== TARGET_PLACEHOLDER, 'Hosted Python has an unbound TARGET placeholder.');
    publicCiTarget(literal);
  }
  return { source: source.slice(0, matches[0].index) + `TARGET = ${JSON.stringify(TARGET_PLACEHOLDER)}`
    + source.slice(matches[0].index + matches[0][0].length), targetUrl: template ? null : publicCiTarget(literal) };
}

export function renderTargetSource(template, targetUrl) {
  const normalized = normalizeTargetSource(template, { template: true });
  const target = publicCiTarget(targetUrl);
  return normalized.source.replace(TARGET_LINE, () => `TARGET = ${JSON.stringify(target)}`);
}

export function verifyHostedTemplate(expected, body, localTemplate) {
  requireThat(body?.testId === expected.testId && body.language === 'python', `${expected.case}: hosted template names another test or language.`);
  requireThat(/^v-[0-9a-f]+$/i.test(body.codeVersion || ''), `${expected.case}: hosted template has no version for an optimistic guard.`);
  requireThat(sha256(localTemplate) === expected.sha256, `${expected.case}: committed template differs from its reviewed manifest.`);
  normalizeTargetSource(localTemplate, { template: true });
  const normalized = normalizeTargetSource(body.code);
  requireThat(normalized.source === localTemplate, `${expected.case}: hosted source changed beyond the one TARGET literal.`);
  return { case: expected.case, testId: expected.testId, codeVersion: body.codeVersion, sha256: sha256(body.code),
    canonicalSha256: expected.sha256, targetUrl: normalized.targetUrl };
}

export async function bindStoredTemplate(expected, localTemplate, targetUrl, { current, put, get }) {
  const previous = verifyHostedTemplate(expected, current, localTemplate);
  const code = renderTargetSource(localTemplate, targetUrl);
  let version = current.codeVersion, changed = false;
  if (current.code !== code) {
    const written = await put({ testId: expected.testId, code, expectedVersion: current.codeVersion });
    requireThat(written?.testId === expected.testId && /^v-[0-9a-f]+$/i.test(written.codeVersion || ''), `${expected.case}: target binding write has no valid version.`);
    version = written.codeVersion;
    changed = true;
  }
  const readback = await get(expected.testId);
  requireThat(readback.language === 'python', `${expected.case}: target binding readback is not Python.`);
  const bound = verifyStoredCode({ ...expected, sha256: sha256(code), codeVersion: version }, readback, code);
  return { ...bound, canonicalSha256: expected.sha256, targetUrl: publicCiTarget(targetUrl), changed,
    previousCodeVersion: previous.codeVersion, previousSha256: previous.sha256 };
}

/** Raw server messages can contain secrets. Emit our own fixed classifications. */
export function safePlatformDiagnostic(value) {
  if (typeof value !== 'string' || !value) return null;
  if (value.includes('Deterministic replay cannot run through a tunnel')) return 'strict-replay-tunnel-unsupported';
  if (value.includes('TEST_TARGET_URL') && /(?:required|missing|not set|nonempty|non-empty)/i.test(value)) return 'test-target-environment-missing';
  return 'unclassified-platform-error';
}

export function safeCliFailure(value, exitCode) {
  return { exitCode: Number.isInteger(exitCode) ? exitCode : null,
    code: CLI_ERROR_CODES.has(value?.error?.code) ? value.error.code : null,
    diagnostic: safePlatformDiagnostic(value?.error?.message) };
}

/** Preserve accepted identities on failures without copying titles, URLs or errors. */
export function safeSummaryRuns(summary, scripts) {
  return scripts.map(script => {
    const matches = summary?.runs?.filter(row => row.testId === script.testId) ?? [];
    const row = matches.length === 1 ? matches[0] : null;
    return { case: script.case, testId: script.testId,
      runId: UUID.test(row?.runId || '') ? row.runId : null,
      status: RUN_STATUSES.has(row?.status) ? row.status : 'missing-or-unknown' };
  });
}

export function safeFailedRun(expected, result, targetUrl, dispatchedAfter) {
  requireThat(UUID.test(expected.runId || '') && result?.runId === expected.runId
    && result.testId === expected.testId && result.projectId === PROJECT, 'Failure facts name another test, run or project.');
  requireThat(RUN_STATUSES.has(result.status), 'Failure facts contain an unrecognized run status.');
  // Do not relabel a failure as a passing attestation. Null or wrong target and
  // source remain explicit mismatches; arbitrary backend strings never escape.
  const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  const startedAt = validTime(result.startedAt), finishedAt = validTime(result.finishedAt);
  let targetMatches = false;
  try { targetMatches = canonicalUrl(result.targetUrl) === canonicalUrl(targetUrl); } catch {}
  return { case: expected.case, testId: result.testId, runId: result.runId, status: result.status, projectId: PROJECT,
    source: result.source === 'cli' ? 'cli' : null, sourceMatches: result.source === 'cli', targetUrl: targetMatches ? canonicalUrl(targetUrl) : null,
    targetMatches, startedAt, finishedAt,
    freshDispatch: !!startedAt && Date.parse(startedAt) >= Date.parse(dispatchedAfter),
    diagnostic: safePlatformDiagnostic(result.error), hasError: typeof result.error === 'string' && result.error.length > 0 };
}

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

export function requireIdleProject(listing) {
  requireThat(Array.isArray(listing?.items), 'The shared project activity listing is invalid.');
  const idle = new Set(['draft', 'ready', 'passed', 'failed', 'blocked', 'cancelled']);
  for (const row of listing.items) {
    requireThat(idle.has(row.status) && (row.statusByEnvironment === undefined || Array.isArray(row.statusByEnvironment))
      && (row.statusByEnvironment ?? []).every(environment => idle.has(environment.status)),
    'The shared TestSprite project has an active or unknown run status; no stored target will be rebound.');
  }
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
    requireThat(UUID.test(row.runId || '') && !runs.has(row.runId), 'Strict replay has a missing, invalid or duplicate run ID.');
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

export function publicCiTarget(value, identity = PUBLIC_CI) {
  const url = new URL(canonicalUrl(value));
  requireThat(url.pathname === '/' && !url.port, 'The public CI target must be a plain HTTPS origin.');
  const prefix = identity.hostnamePrefixes.find(value => url.hostname.startsWith(value));
  requireThat(prefix && url.hostname.endsWith(identity.hostnameSuffix), 'The public CI target is outside its reviewed deployment namespace.');
  const opaque = url.hostname.slice(prefix.length, -identity.hostnameSuffix.length);
  requireThat(/^[a-z0-9]{9}$/.test(opaque), 'A mutable alias is not a unique public CI deployment target.');
  return url.href;
}

function trustedVercelActor(row, identity) {
  return row?.creator?.id === identity.githubBotId && row.creator.login === 'vercel[bot]' && row.creator.type === 'Bot'
    && (row.performed_via_github_app == null || (row.performed_via_github_app.id === identity.githubAppId
      && row.performed_via_github_app.slug === 'vercel'));
}

export function ciInspector(value, identity = PUBLIC_CI) {
  const url = new URL(canonicalUrl(value));
  const prefix = `/${identity.teamSlug}/${identity.projectName}/`;
  requireThat(url.hostname === 'vercel.com' && !url.port && url.pathname.startsWith(prefix), 'The Vercel status names another team or project.');
  const id = url.pathname.slice(prefix.length);
  requireThat(/^[a-zA-Z0-9]+$/.test(id), 'The CI status has no exact deployment identity.');
  return { inspectorUrl: url.href, deploymentId: `dpl_${id}` };
}

export function selectCiCommitStatus(combined, headSha, identity = PUBLIC_CI) {
  requireThat(combined?.sha === headSha && Array.isArray(combined.statuses), 'GitHub returned CI statuses for another commit.');
  const rows = combined.statuses.filter(row => row.context === `Vercel – ${identity.projectName}`);
  requireThat(rows.length <= 1, 'GitHub returned ambiguous CI commit statuses.');
  if (!rows.length || rows[0].state === 'pending') return null;
  requireThat(rows[0].state === 'success', 'The dedicated public CI deployment failed or was cancelled.');
  return { ...ciInspector(rows[0].target_url, identity), statusId: rows[0].id };
}

/** The bot's per-project metadata links the inspector to the stable project ID. */
export function ciCommentProject(comments, inspectorUrl, identity = PUBLIC_CI) {
  const projects = [];
  for (const row of comments) {
    if (row?.user?.id !== identity.githubBotId || row.user.login !== 'vercel[bot]' || row.user.type !== 'Bot') continue;
    const metadata = typeof row.body === 'string' && row.body.match(/^\[vc\]: #[^:\r\n]+:([A-Za-z0-9+/]+={0,2})(?:\r?\n|$)/);
    if (!metadata) continue;
    let decoded;
    try { decoded = JSON.parse(Buffer.from(metadata[1], 'base64').toString('utf8')); } catch { continue; }
    if (decoded?.type !== 'github' || !Array.isArray(decoded.projects)) continue;
    const matches = decoded.projects.filter(project => project.projectId === identity.projectId && project.name === identity.projectName);
    requireThat(matches.length <= 1, 'Vercel comment contains duplicate CI project metadata.');
    if (matches.length && matches[0].inspectorUrl === inspectorUrl) projects.push({ commentId: row.id, updatedAt: row.updated_at, projectId: matches[0].projectId });
  }
  if (!projects.length) return null;
  projects.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.commentId - a.commentId);
  return projects[0];
}

export function selectCiDeployment(deployments, headSha, identity = PUBLIC_CI) {
  requireThat(Array.isArray(deployments), 'GitHub deployment listing is invalid.');
  requireThat(deployments.every(row => row.sha === headSha), 'GitHub returned a deployment for another commit.');
  const rows = deployments.filter(row => identity.environments.includes(row.environment));
  if (!rows.length) return null;
  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const row = rows[0];
  requireThat(Number.isSafeInteger(row.id) && row.id > 0 && trustedVercelActor(row, identity)
    && row.task === 'deploy' && row.repository_url === `https://api.github.com/repos/${REPOSITORY}`,
  'The CI deployment was not created by the reviewed Vercel integration in this repository.');
  return row;
}

export function ciDeploymentTarget(deployment, statuses, identity = PUBLIC_CI) {
  requireThat(Array.isArray(statuses), 'GitHub deployment-status listing is invalid.');
  if (!statuses.length) return null;
  const rows = [...statuses].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const row = rows[0];
  requireThat(trustedVercelActor(row, identity) && row.deployment_url === `https://api.github.com/repos/${REPOSITORY}/deployments/${deployment.id}`
    && row.environment === deployment.environment, 'The CI deployment status has a foreign actor, deployment or environment.');
  if (['pending', 'queued', 'in_progress'].includes(row.state)) return null;
  requireThat(row.state === 'success', 'The latest CI deployment status is not successful.');
  const targetUrl = publicCiTarget(row.environment_url, identity);
  requireThat(publicCiTarget(row.target_url, identity) === targetUrl && publicCiTarget(row.log_url, identity) === targetUrl,
    'The CI deployment status has inconsistent public origins.');
  return { targetUrl, githubDeploymentId: deployment.id, githubStatusId: row.id, environment: row.environment };
}

export function verifyPullRequest(pr, headSha) {
  requireThat(pr?.head?.repo?.full_name === REPOSITORY && pr.head.sha === headSha && pr.state === 'open',
    'This run is not the current open same-repository PR head.');
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

export function verifyPublicReceipt(receipt, runs) {
  requireThat(Array.isArray(receipt?.accepted) && receipt.accepted.length === runs.length,
    'Public dispatch receipt is incomplete.');
  for (const field of ['conflicts', 'deferred', 'skippedFrontend', 'skippedIntegration']) {
    requireThat(Array.isArray(receipt[field]) && receipt[field].length === 0, `Public dispatch receipt has ${field} or is missing that field.`);
  }
  const expected = new Map(runs.map(row => [row.testId, row]));
  const seen = new Set();
  for (const row of receipt.accepted) {
    requireThat(expected.has(row.testId) && !seen.has(row.testId) && row.status === 'passed'
      && expected.get(row.testId).runId === row.runId, 'Public dispatch receipt disagrees with actual summary identities.');
    seen.add(row.testId);
  }
  return { accepted: runs.length, conflicts: 0, deferred: 0, skippedFrontend: 0, skippedIntegration: 0 };
}

export function verifyActualPasses(rows, scripts) {
  requireThat(rows.length === scripts.length && new Set(rows.map(row => row.testId)).size === scripts.length,
    'The strict replay has incomplete actual run attestations.');
  const expected = new Set(scripts.map(row => row.testId));
  for (const row of rows) requireThat(expected.has(row.testId) && UUID.test(row.runId || '') && row.status === 'passed'
    && row.projectId === PROJECT && row.source === 'cli' && row.replayPath === 'replay'
    && row.replayReason === null && row.replayCaveat === null,
  'Every actual run response must independently attest a passed strict replay.');
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
    let value;
    try { value = JSON.parse(error.stdout); } catch {}
    let errorEnvelope;
    try { errorEnvelope = JSON.parse(error.stderr.slice(error.stderr.lastIndexOf('\n{') + 1)); } catch {}
    const diagnostic = safeCliFailure(errorEnvelope ?? value, error.code);
    const failure = new Error(`${command} request failed (exit ${diagnostic.exitCode ?? 'unavailable'}${diagnostic.code ? `, ${diagnostic.code}` : ''}); raw output was withheld.`);
    failure.safeDiagnostic = diagnostic;
    // Private in-process only. Callers must select explicit safe fields before
    // this response can reach a report; never serialize the Error object.
    failure.response = value;
    throw failure;
  }
  try { return JSON.parse(result.stdout); } catch { throw new Error(`${command} returned an invalid JSON response.`); }
}

async function github(path) {
  return commandJson('gh', ['api', '--method', 'GET', path]);
}

async function githubList(path) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const value = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    requireThat(Array.isArray(value), 'GitHub returned an invalid paginated list.');
    rows.push(...value);
    if (value.length < 100) return rows;
  }
  throw new Error('GitHub listing exceeded the complete-pagination safety bound.');
}

async function publicCiDeployment(repository, prNumber, headSha, { wait = true } = {}) {
  const deadline = Date.now() + 9 * 60 * 1000;
  while (Date.now() < deadline) {
    verifyPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), headSha);
    const [combined, deployments] = await Promise.all([
      github(`repos/${repository}/commits/${headSha}/status`),
      githubList(`repos/${repository}/deployments?sha=${headSha}`),
    ]);
    const commitStatus = selectCiCommitStatus(combined, headSha);
    const deployment = selectCiDeployment(deployments, headSha);
    if (commitStatus && deployment) {
      const status = ciDeploymentTarget(deployment, await githubList(`repos/${repository}/deployments/${deployment.id}/statuses`));
      if (status) {
        const project = ciCommentProject(await githubList(`repos/${repository}/issues/${prNumber}/comments`), commitStatus.inspectorUrl);
        if (project) return { ...status, ...commitStatus, projectId: project.projectId, commentId: project.commentId,
          commitSha: headSha, creatorId: PUBLIC_CI.githubBotId };
      }
    }
    if (!wait) break;
    await new Promise(resolveWait => setTimeout(resolveWait, 15000));
  }
  throw new Error('No complete authenticated public CI deployment binding became ready for this exact PR head.');
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
    requestedReplay: { requiredCliVersion: '0.15.0', command: 'test run --target-url', autoHeal: false, caseCount: 16, pollConcurrency: 3 },
    attestationLimit: 'Backend null codeVersion and autoHeal values remain null; unqualified replay and unchanged pre/post bound stored source are verified separately.',
    templatesBefore: [], storedBefore: [], storedAfter: [], runs: [],
  };
  try {
    requireThat(process.env.TESTSPRITE_API_KEY, 'TESTSPRITE_API_KEY repository secret is missing.');
    requireThat(/^[0-9a-f]{40}$/i.test(report.headSha || ''), 'An exact PR head SHA is required.');
    const repository = process.env.GITHUB_REPOSITORY;
    const prNumber = process.env.PR_NUMBER;
    requireThat(repository === REPOSITORY && /^\d+$/.test(prNumber || ''), 'A same-repository Paperwild pull request is required.');
    const pr = await github(`repos/${repository}/pulls/${prNumber}`);
    verifyPullRequest(pr, report.headSha);
    await checkoutState(root, report.headSha);
    const manifest = JSON.parse(await readFile(resolve(root, MANIFEST), 'utf8'));
    const scripts = validateManifest(manifest);
    requireThat(manifest.binding?.kind === 'dedicated-public-ci-deployment' && manifest.binding.projectId === PUBLIC_CI.projectId
      && manifest.binding.templateVersion === 1, 'The reviewed target-only template/public CI binding is missing.');
    publicCiTarget(manifest.targetUrl);
    requireThat(manifest.convexUrl === 'https://fast-starling-207.convex.cloud' && process.env.VITE_CONVEX_URL === manifest.convexUrl,
      'Strict build must use the reviewed public Convex development URL.');
    report.buildEnvironment = { publicConvexUrl: manifest.convexUrl };
    report.binding = { kind: 'single-target-literal-template', templateVersion: 1, projectId: PUBLIC_CI.projectId };
    const cliEnv = { ...process.env, GITHUB_ACTIONS: 'false' };
    delete cliEnv.GITHUB_STEP_SUMMARY;
    delete cliEnv.GITHUB_OUTPUT;
    const cli = args => commandJson('testsprite', [...args, '--output', 'json'], cliEnv);
    const temporary = await mkdtemp(resolve(tmpdir(), 'paperwild-testsprite-'));
    const sourceByCase = new Map();
    for (const script of scripts) sourceByCase.set(script.case, await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8'));
    const initialBuild = await buildSnapshot(resolve(root, 'dist'));
    const unchangedBuild = async () => {
      const now = await buildSnapshot(resolve(root, 'dist'));
      requireThat(now.proof.fileCount === initialBuild.proof.fileCount && now.proof.treeSha256 === initialBuild.proof.treeSha256,
        'The local built files changed during verification.');
    };
    console.log('Waiting for the authenticated dedicated public CI deployment of this exact PR head.');
    const deployment = await publicCiDeployment(repository, prNumber, report.headSha);
    const targetUrl = deployment.targetUrl;
    report.preview = { kind: 'dedicated-public-ci-unique-deployment', ...deployment, branch: pr.head.ref };
    report.buildBefore = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl, deployment.deploymentId);
    await unchangedBuild();
    const projectListing = await cli(['test', 'list', '--project', PROJECT]);
    report.projectBefore = verifyProjectCases(projectListing, scripts);
    requireIdleProject(projectListing);
    const initialStored = new Map();
    // Audit every canonical scenario before any transport-only update.
    for (const script of scripts) {
      const current = await cli(['test', 'code', 'get', script.testId]);
      report.templatesBefore.push(verifyHostedTemplate(script, current, sourceByCase.get(script.case)));
      initialStored.set(script.testId, current);
    }
    verifyPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha);
    await checkoutState(root, report.headSha);
    await unchangedBuild();
    // The project-wide workflow lock serializes these guarded updates. A CAS
    // conflict fails without refetch/retry/force; no gameplay code is generated.
    for (const script of scripts) {
      const bound = await bindStoredTemplate(script, sourceByCase.get(script.case), targetUrl, {
        current: initialStored.get(script.testId), get: testId => cli(['test', 'code', 'get', testId]),
        put: async ({ testId, code, expectedVersion }) => {
          const path = resolve(temporary, `${script.case}.py`);
          await writeFile(path, code, { mode: 0o600 });
          return cli(['test', 'code', 'put', testId, '--expected-version', expectedVersion, '--code-file', path]);
        },
      });
      report.storedBefore.push(bound);
    }
    verifyPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha);
    await checkoutState(root, report.headSha);
    await unchangedBuild();
    console.log('All 16 canonical scenarios and exact target-only stored bindings verified; the public PR build is ready.');
    const rawSummary = resolve(temporary, 'summary.json');
    const dispatchedAfter = new Date().toISOString();
    report.dispatchedAfter = dispatchedAfter;
    let replayFailure = null;
    try {
      let receipt, cliFailure = null;
      try {
        receipt = await commandJson('testsprite', ['test', 'run', '--all', '--project', PROJECT,
          '--target-url', targetUrl, '--max-concurrency', '3', '--no-auto-heal', '--wait', '--timeout', '1200',
          '--report', 'junit', '--report-file', resolve(temporary, 'junit.xml'),
          '--summary-file', rawSummary, '--output', 'json'], cliEnv, 25 * 60 * 1000);
      } catch (error) {
        cliFailure = error;
        if (error.safeDiagnostic) report.cliFailure = error.safeDiagnostic;
      }
      let summary;
      try { summary = JSON.parse(await readFile(rawSummary, 'utf8')); } catch { throw cliFailure || new Error('Strict replay did not produce a summary.'); }
      report.runs = safeSummaryRuns(summary, scripts);
      let factsFailure = null;
      for (const script of scripts) {
        const index = report.runs.findIndex(row => row.testId === script.testId);
        const requested = report.runs[index];
        if (!requested.runId) { factsFailure ??= new Error('A strict result has no valid actual run ID.'); continue; }
        try {
          let actual;
          try { actual = await cli(['test', 'wait', requested.runId, '--timeout', '30']); }
          catch (error) { if (error.response?.runId === requested.runId) actual = error.response; else throw error; }
          const bound = report.storedBefore.find(row => row.testId === script.testId);
          report.runs[index] = actual.status === 'passed'
            ? verifyRun({ ...bound, runId: requested.runId, dispatchedAfter }, actual, targetUrl)
            : safeFailedRun(requested, actual, targetUrl, dispatchedAfter);
        } catch (error) {
          factsFailure ??= error;
          report.runs[index].diagnostic = 'actual-run-facts-unverified';
        }
      }
      const runs = verifySummary(summary, scripts);
      if (factsFailure) throw factsFailure;
      verifyActualPasses(report.runs, scripts);
      if (cliFailure) throw cliFailure;
      report.dispatchReceipt = verifyPublicReceipt(receipt, runs);
    } catch (error) { replayFailure = error; }

    // Failure still gets an audit, never another execution or a healed script.
    try {
      for (const script of scripts) {
        const bound = report.storedBefore.find(row => row.testId === script.testId);
        const local = await readFile(resolve(root, 'docs/testsprite/overrides', `${script.case}.py`), 'utf8');
        requireThat(sha256(local) === script.sha256, `${script.case}: committed template changed during replay.`);
        const stored = await cli(['test', 'code', 'get', script.testId]);
        requireThat(stored.language === 'python', `${script.case}: hosted source is not Python.`);
        report.storedAfter.push({ ...verifyStoredCode(bound, stored, renderTargetSource(local, targetUrl)), canonicalSha256: script.sha256, targetUrl });
      }
      report.projectAfter = verifyProjectCases(await cli(['test', 'list', '--project', PROJECT]), scripts);
      verifyPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha);
      await checkoutState(root, report.headSha);
      await unchangedBuild();
      report.buildAfter = await verifyPreviewBuild(resolve(root, 'dist'), targetUrl, deployment.deploymentId);
      requireThat(report.buildAfter.fileCount === report.buildBefore.fileCount && report.buildAfter.treeSha256 === report.buildBefore.treeSha256,
        'The exact public CI build changed during replay.');
      const after = await publicCiDeployment(repository, prNumber, report.headSha, { wait: false });
      requireThat(after.githubDeploymentId === deployment.githubDeploymentId && after.deploymentId === deployment.deploymentId
        && after.targetUrl === targetUrl && after.projectId === PUBLIC_CI.projectId, 'The authenticated public CI deployment binding changed during replay.');
      await unchangedBuild();
      verifyPullRequest(await github(`repos/${repository}/pulls/${prNumber}`), report.headSha);
      await checkoutState(root, report.headSha);
      report.postRunAuditCompleted = true;
    } catch (error) {
      report.postRunAuditError = error.message;
      replayFailure ??= error;
    }
    if (replayFailure) throw replayFailure;
    report.verified = true;
    console.log('Verified: 16/16 exact target-bound stored scenarios passed; every public CI build file matched before and after replay.');
  } catch (error) {
    report.error = error.message;
    if (error.safeDiagnostic) report.cliFailure = error.safeDiagnostic;
    process.exitCode = 1;
    console.error(report.error);
  } finally {
    await writeReports(outputDirectory, report);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runGate();
