import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { compareBuildFiles, LOCAL_TARGET_URL, previewForBranch, selectVercelStatus, startBuildServer, strictLocalTarget, targetForPullRequest, validateManifest, vercelDeploymentId, verifyCheckoutState, verifyPreviewBuild, verifyPreviewIndex, verifyProjectCases, verifyRun, verifyStoredCode, verifySummary, verifyTunnelReceipt, withBuildServer } from '../scripts/testsprite-ci.mjs';

const manifest = JSON.parse(await readFile(new URL('../docs/testsprite/pr5-stored-code-manifest.json', import.meta.url), 'utf8'));
const scripts = validateManifest(manifest);
const target = 'https://paperwild-a1b2c3d4-davidson3556s-projects.vercel.app/';
const head = 'a'.repeat(40);
const summary = () => ({ total: 16, passed: 16, failed: 0, skipped: 0, timedOut: 0, runs: scripts.map((row, index) => ({ testId: row.testId, runId: `run-${index}`, status: 'passed' })) });

test('the gate requires all 16 distinct reviewed cases in the intended project', () => {
  assert.equal(scripts.length, 16);
  assert.throws(() => validateManifest({ ...manifest, scripts: scripts.slice(1) }), /16/);
  assert.throws(() => validateManifest({ ...manifest, scripts: [...scripts.slice(1), scripts[1]] }), /Duplicate/);
  assert.throws(() => validateManifest({ ...manifest, projectId: 'another-project' }), /another project/);
  assert.throws(() => validateManifest({ ...manifest, scripts: scripts.map((row, index) => index ? row : { ...row, readbackEqual: false }) }), /readback/);
});

test('public project dispatch refuses extra, missing, duplicate, foreign and incompletely listed tests', () => {
  const listing = { items: scripts.map(row => ({ id: row.testId, projectId: manifest.projectId, type: 'frontend' })), nextToken: null };
  assert.equal(verifyProjectCases(listing, scripts).testIds.length, 16);
  assert.throws(() => verifyProjectCases({ ...listing, items: listing.items.slice(1) }, scripts), /exactly the 16/);
  assert.throws(() => verifyProjectCases({ ...listing, items: [...listing.items, { ...listing.items[0], id: 'unreviewed' }] }, scripts), /exactly the 16/);
  assert.throws(() => verifyProjectCases({ ...listing, items: [...listing.items.slice(1), listing.items[1]] }, scripts), /duplicate/);
  assert.throws(() => verifyProjectCases({ ...listing, items: listing.items.map((row, index) => index ? row : { ...row, id: 'unreviewed' }) }, scripts), /unexpected/);
  assert.throws(() => verifyProjectCases({ ...listing, items: listing.items.map((row, index) => index ? row : { ...row, projectId: 'another-project' }) }, scripts), /another project/);
  assert.throws(() => verifyProjectCases({ ...listing, items: listing.items.map((row, index) => index ? row : { ...row, type: 'backend' }) }, scripts), /unexpected test type/);
  assert.throws(() => verifyProjectCases({ ...listing, nextToken: 'more-tests' }, scripts), /complete project/);
  const missingToken = { ...listing }; delete missingToken.nextToken;
  assert.throws(() => verifyProjectCases(missingToken, scripts), /complete project/);
});

test('stored version and both local and hosted bytes must match', () => {
  const source = 'reviewed Python source\n';
  const expected = { ...scripts[0], sha256: createHash('sha256').update(source).digest('hex') };
  const stored = { testId: expected.testId, codeVersion: expected.codeVersion, code: source };
  assert.equal(verifyStoredCode(expected, stored, source).codeVersion, expected.codeVersion);
  assert.throws(() => verifyStoredCode(expected, { ...stored, code: source + '#' }, source), /hosted source/i);
  assert.throws(() => verifyStoredCode(expected, stored, source + '#'), /committed source/i);
  assert.throws(() => verifyStoredCode(expected, { ...stored, codeVersion: 'v-drift' }, source), /version drifted/);
  assert.throws(() => verifyStoredCode(expected, { ...stored, code: 'https://signed.example/file?token=secret' }, source), /inline/);
});

test('a complete 16-pass summary is accepted', () => {
  assert.equal(verifySummary(summary(), scripts).length, 16);
});

for (const status of ['failed', 'blocked', 'skipped', 'timeout', 'cancelled']) {
  test(`a ${status} result cannot be hidden by green aggregate counts`, () => {
    const value = summary();
    value.runs[0].status = status;
    assert.throws(() => verifySummary(value, scripts), /did not pass/);
  });
}

test('missing, duplicate and unrelated results cannot produce a pass', () => {
  const missing = summary(); missing.runs.pop();
  assert.throws(() => verifySummary(missing, scripts), /missing or extra/);
  const duplicate = summary(); duplicate.runs[1] = duplicate.runs[0];
  assert.throws(() => verifySummary(duplicate, scripts), /duplicate/);
  const unrelated = summary(); unrelated.runs[0].testId = 'unknown';
  assert.throws(() => verifySummary(unrelated, scripts), /unexpected/);
  const missingCounter = summary(); delete missingCounter.skipped;
  assert.throws(() => verifySummary(missingCounter, scripts), /missing that counter/);
});

test('actual run facts must prove target and unqualified replay; supplied versions must match', () => {
  const expected = { ...scripts[0], runId: 'actual-run' };
  const actual = { runId: expected.runId, testId: expected.testId, projectId: 'dafdf75c-04a3-467f-acc2-4359af6b1d8e', status: 'passed', source: 'cli', codeVersion: expected.codeVersion, targetUrl: target, autoHeal: false, replay: { path: 'replay', reason: null, caveat: null } };
  assert.equal(verifyRun(expected, actual, target).status, 'passed');
  assert.throws(() => verifyRun(expected, { ...actual, autoHeal: true }, target), /enabled/);
  assert.throws(() => verifyRun(expected, { ...actual, autoHeal: 'false' }, target), /unrecognized/);
  const noConfirmation = { ...actual }; delete noConfirmation.autoHeal;
  noConfirmation.codeVersion = null;
  const attestation = verifyRun(expected, noConfirmation, target);
  assert.equal(attestation.autoHeal, null);
  assert.equal(attestation.runCodeVersion, null);
  assert.equal(attestation.reviewedCodeVersion, expected.codeVersion);
  assert.throws(() => verifyRun(expected, { ...actual, targetUrl: 'https://paperwild.vercel.app/' }, target), /different preview/);
  assert.throws(() => verifyRun(expected, { ...actual, codeVersion: 'v-another' }, target), /different stored/);
  assert.throws(() => verifyRun(expected, { ...actual, replay: { path: 'refused' } }, target), /unqualified/);
  assert.throws(() => verifyRun(expected, { ...actual, replay: { path: 'replay', caveat: 'unsupported' } }, target), /unqualified/);
  assert.throws(() => verifyRun(expected, { ...actual, replay: null }, target), /unqualified/);
  assert.throws(() => verifyRun(expected, { ...actual, replay: { path: 'replay', reason: '', caveat: null } }, target), /unqualified/);
  assert.throws(() => verifyRun(expected, { ...actual, projectId: 'another-project' }, target), /this project/);
  assert.throws(() => verifyRun(expected, { ...actual, testId: 'another-test' }, target), /test\/run pair/);
  assert.throws(() => verifyRun(expected, { ...actual, runId: 'another-run' }, target), /test\/run pair/);
  assert.throws(() => verifyRun(expected, { ...actual, source: 'portal' }, target), /CLI replay/);
});

test('the HTTP exception accepts only the literal owned loopback origin and root', () => {
  assert.equal(strictLocalTarget('http://127.0.0.1:4173'), LOCAL_TARGET_URL);
  assert.equal(strictLocalTarget(LOCAL_TARGET_URL), LOCAL_TARGET_URL);
  for (const wrong of ['http://localhost:4173/', 'http://127.0.0.1:4174/', 'http://127.0.0.1/',
    'http://0.0.0.0:4173/', 'http://2130706433:4173/', 'http://127.0.0.1:4173/other',
    'http://127.0.0.1:4173/?token=x', 'http://127.0.0.1:4173/#fragment',
    'http://user:secret@127.0.0.1:4173/', 'https://127.0.0.1:4173/', ' http://127.0.0.1:4173/']) {
    assert.throws(() => strictLocalTarget(wrong), /exactly/);
  }
  const expected = { ...scripts[0], runId: 'fresh', dispatchedAfter: '2026-10-25T12:00:00Z' };
  const actual = { runId: 'fresh', testId: expected.testId, projectId: manifest.projectId, status: 'passed', source: 'cli',
    targetUrl: LOCAL_TARGET_URL.slice(0, -1), codeVersion: null,
    startedAt: '2026-10-25T12:00:01Z', finishedAt: '2026-10-25T12:00:02Z',
    replay: { path: 'replay', reason: null, caveat: null } };
  assert.equal(verifyRun(expected, actual, LOCAL_TARGET_URL).targetUrl, LOCAL_TARGET_URL);
  assert.throws(() => verifyRun(expected, { ...actual, targetUrl: 'http://another.example:4173/' }, LOCAL_TARGET_URL), /exactly/);
  assert.throws(() => verifyRun(expected, { ...actual, startedAt: '2026-10-25T11:59:59Z' }, LOCAL_TARGET_URL), /timestamps/);
  assert.throws(() => verifyRun(expected, { ...actual, startedAt: null }, LOCAL_TARGET_URL), /timestamps/);
  assert.throws(() => verifyRun(expected, { ...actual, targetUrl: 'http://another.example/' }, 'http://another.example/'), /HTTPS/);
});

test('future branch names use the owned build while fork, stale and closed PRs fail', () => {
  const pr = { state: 'open', head: { sha: head, ref: 'new/chess-improvement', repo: { full_name: 'Davidson3556/Paperwild' } } };
  assert.equal(targetForPullRequest(pr, head, LOCAL_TARGET_URL), LOCAL_TARGET_URL);
  assert.equal(targetForPullRequest({ ...pr, head: { ...pr.head, ref: 'fix/a-completely-different-branch' } }, head, LOCAL_TARGET_URL), LOCAL_TARGET_URL);
  assert.throws(() => targetForPullRequest({ ...pr, head: { ...pr.head, repo: { full_name: 'someone/fork' } } }, head, LOCAL_TARGET_URL), /same-repository/);
  assert.throws(() => targetForPullRequest(pr, 'b'.repeat(40), LOCAL_TARGET_URL), /head/);
  assert.throws(() => targetForPullRequest({ ...pr, state: 'closed' }, head, LOCAL_TARGET_URL), /head/);
  assert.throws(() => targetForPullRequest(pr, head, target), /exactly/);
  verifyCheckoutState(head, head + '\n', '');
  assert.throws(() => verifyCheckoutState(head, 'b'.repeat(40), ''), /Checkout/);
  assert.throws(() => verifyCheckoutState(head, head, ' M src/main.ts\n'), /source changed/);
  assert.throws(() => verifyCheckoutState(head, head, '?? src/untracked.ts\n'), /untracked/);
});

test('a native tunnel receipt must own the session and match every actual summary identity', () => {
  const runs = summary().runs;
  const receipt = { tunnel: { clientId: '07cb7ab5-3a1b-48e1-86cd-2a156218679e', adopted: false }, maxConcurrency: 3, results: runs };
  assert.equal(verifyTunnelReceipt(receipt, runs).owned, true);
  assert.throws(() => verifyTunnelReceipt({ ...receipt, tunnel: { ...receipt.tunnel, adopted: true } }, runs), /owned/);
  assert.throws(() => verifyTunnelReceipt({ ...receipt, tunnel: undefined }, runs), /owned/);
  assert.throws(() => verifyTunnelReceipt({ ...receipt, tunnel: { ...receipt.tunnel, clientId: 'not-a-client-id' } }, runs), /owned/);
  assert.throws(() => verifyTunnelReceipt({ ...receipt, results: runs.slice(1) }, runs), /incomplete/);
  assert.throws(() => verifyTunnelReceipt({ ...receipt, results: runs.map((r, i) => i ? r : { ...r, runId: 'old-run' }) }, runs), /disagrees/);
});

async function buildFixture(t) {
  const parent = await mkdtemp(resolve(tmpdir(), 'paperwild-gate-test-'));
  const directory = resolve(parent, 'dist');
  t.after(() => rm(parent, { recursive: true, force: true }));
  await mkdir(resolve(directory, 'assets'), { recursive: true });
  await writeFile(resolve(directory, 'index.html'), '<!doctype html><html><body>Exact build</body></html>');
  await writeFile(resolve(directory, 'assets/client.js'), 'export const game = "reviewed";\n');
  return directory;
}

function rawRequest(targetUrl, path, method = 'GET') {
  return new Promise((resolveRequest, reject) => {
    const target = new URL(targetUrl);
    const req = request({ hostname: target.hostname, port: target.port, method, path }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
}

test('owned static server serves exact build bytes and rejects unsafe or unknown paths', async t => {
  const directory = await buildFixture(t);
  await writeFile(resolve(directory, '../outside-secret.txt'), 'outside build');
  t.after(() => rm(resolve(directory, '../outside-secret.txt'), { force: true }));
  const server = await startBuildServer(directory, { port: 0 });
  t.after(() => server.close());
  assert.equal(new URL(server.targetUrl).hostname, '127.0.0.1');
  const proof = await verifyPreviewBuild(directory, server.targetUrl);
  assert.deepEqual({ fileCount: proof.fileCount, treeSha256: proof.treeSha256 }, server.initialBuildProof);
  assert.equal(proof.index.normalization, 'none');
  assert.equal((await rawRequest(server.targetUrl, '/?invite=public-code')).status, 200);
  const script = await rawRequest(server.targetUrl, '/assets/client.js');
  assert.equal(script.body, 'export const game = "reviewed";\n');
  assert.equal(script.headers['content-type'], 'application/javascript; charset=utf-8');
  assert.equal((await rawRequest(server.targetUrl, '/assets/client.js', 'HEAD')).body, '');
  assert.equal((await rawRequest(server.targetUrl, '/assets/client.js', 'POST')).status, 405);
  for (const path of ['/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/assets/%2e%2e/%2e%2e/outside-secret.txt', '/%5c..%5coutside-secret.txt', '/%00', '/%ZZ', '//other.example/index.html']) {
    const response = await rawRequest(server.targetUrl, path);
    assert.equal(response.status, 400, path);
    assert.ok(!response.body.includes('outside build'));
  }
  assert.equal((await rawRequest(server.targetUrl, '/missing')).status, 404);
});

test('an occupied port is refused without taking ownership of the other server', async t => {
  const directory = await buildFixture(t), first = await startBuildServer(directory, { port: 0 });
  t.after(() => first.close());
  const port = Number(new URL(first.targetUrl).port);
  await assert.rejects(startBuildServer(directory, { port }), { code: 'EADDRINUSE' });
  assert.equal((await rawRequest(first.targetUrl, '/')).status, 200);
});

test('a failed operation closes the owned server and releases its port', async t => {
  const directory = await buildFixture(t);
  let owner;
  await assert.rejects(withBuildServer(directory, async server => {
    owner = server;
    assert.equal((await rawRequest(server.targetUrl, '/')).status, 200);
    throw new Error('simulated replay failure');
  }, { port: 0 }), /simulated replay failure/);
  assert.equal(owner.closed, true);
  await owner.close();
  const replacement = await startBuildServer(directory, { port: Number(new URL(owner.targetUrl).port) });
  await replacement.close();
});

test('a frozen server rejects local build mutations instead of serving new bytes', async t => {
  const directory = await buildFixture(t), server = await startBuildServer(directory, { port: 0 });
  t.after(() => server.close());
  await server.assertUnchanged();
  await writeFile(resolve(directory, 'assets/client.js'), 'changed during replay');
  assert.equal((await rawRequest(server.targetUrl, '/assets/client.js')).body, 'export const game = "reviewed";\n');
  await assert.rejects(server.assertUnchanged(), /built files changed/);
  await assert.rejects(verifyPreviewBuild(directory, server.targetUrl), /bytes differ/);
});

test('symlinks and absent application HTML are rejected before binding a server', async t => {
  const directory = await buildFixture(t);
  await symlink(resolve(directory, 'index.html'), resolve(directory, 'assets/leak.html'));
  await assert.rejects(startBuildServer(directory, { port: 0 }), /symlink/);
  await rm(resolve(directory, 'assets/leak.html'));
  await rm(resolve(directory, 'index.html'));
  await assert.rejects(startBuildServer(directory, { port: 0 }), /missing index/);
});

test('Vercel status selection binds its status to the exact head and project', () => {
  const status = { context: 'Vercel', state: 'success', target_url: 'https://vercel.com/davidson3556s-projects/paperwild/aDeployment' };
  assert.equal(selectVercelStatus({ sha: head, statuses: [status] }, head), status);
  assert.throws(() => selectVercelStatus({ sha: 'b'.repeat(40), statuses: [status] }, head), /another commit/);
  assert.equal(selectVercelStatus({ sha: head, statuses: [{ ...status, context: 'Vercel Preview Comments' }] }, head), null);
  assert.equal(selectVercelStatus({ sha: head, statuses: [{ ...status, target_url: 'https://vercel.com/another/project/deployment' }] }, head), null);
  assert.equal(vercelDeploymentId(status), 'dpl_aDeployment');
  assert.throws(() => vercelDeploymentId({ ...status, target_url: status.target_url + '?secret=x' }), /identity/);
  assert.throws(() => vercelDeploymentId({ ...status, target_url: status.target_url + '/other' }), /identity/);
});

test('only the reviewed feature branch can use its current preview binding', () => {
  const alias = 'https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/';
  assert.equal(previewForBranch('feat/convex-multiplayer', alias), alias);
  assert.throws(() => previewForBranch('new-feature', alias), /no reviewed/);
  assert.throws(() => previewForBranch('living', alias), /no reviewed/);
  assert.throws(() => previewForBranch('feat/convex-multiplayer', target), /different preview/);
  assert.throws(() => previewForBranch('feat/convex-multiplayer', 'https://paperwild-git-living-davidson3556s-projects.vercel.app/'), /different preview/);
});

test('deployment proof compares every asset including art and rejects missing bytes', () => {
  const files = [{ path: 'index.html', sha256: 'index' }, { path: 'assets/app.js', sha256: 'script' }, { path: 'art/creature.png', sha256: 'painting' }];
  assert.equal(compareBuildFiles(files, [...files].reverse()).fileCount, 3);
  assert.throws(() => compareBuildFiles(files, files.slice(0, 2)), /missing or duplicate/);
  assert.throws(() => compareBuildFiles(files, files.map(row => row.path.startsWith('art/') ? { ...row, sha256: 'old painting' } : row)), /art\/creature/);
});

const deploymentId = 'dpl_2wMNHkU4erapMLS7PUUzCCgqyBj7';
const localHtml = Buffer.from('<!doctype html>\n<html><body>Reviewed game</body></html>\n');
const toolbarTag = id => Buffer.from(`<script async data-explicit-opt-in="true" data-deployment-id="${id}" src="https://vercel.live/_next-live/feedback/feedback.js"></script>`);

test('only the exact single appended Vercel toolbar tag is normalized and recorded', () => {
  const remote = Buffer.concat([localHtml, toolbarTag(deploymentId)]);
  const proof = verifyPreviewIndex(localHtml, remote, deploymentId);
  assert.equal(proof.normalization, 'one-exact-appended-vercel-feedback-tag');
  assert.equal(proof.deploymentId, deploymentId);
  assert.equal(proof.rawSha256, createHash('sha256').update(remote).digest('hex'));
  assert.equal(proof.normalizedSha256, createHash('sha256').update(localHtml).digest('hex'));
  assert.equal(verifyPreviewIndex(localHtml, localHtml, deploymentId).normalization, 'none');
});

test('a toolbar belonging to another deployment cannot attest this PR preview', () => {
  assert.throws(() => verifyPreviewIndex(localHtml, Buffer.concat([localHtml, toolbarTag('dpl_anotherDeployment')]), deploymentId), /differs beyond/);
});

test('unrelated injected scripts are never stripped by HTML verification', () => {
  assert.throws(() => verifyPreviewIndex(localHtml, Buffer.concat([localHtml, Buffer.from('<script src="https://other.example/script.js"></script>')]), deploymentId), /differs beyond/);
});

test('a correct toolbar cannot hide an altered application document', () => {
  const changed = Buffer.from(localHtml.toString().replace('Reviewed game', 'Different game'));
  assert.throws(() => verifyPreviewIndex(localHtml, Buffer.concat([changed, toolbarTag(deploymentId)]), deploymentId), /differs beyond/);
});

test('multiple or moved toolbar tags are not accepted as the one permitted suffix', () => {
  const tag = toolbarTag(deploymentId);
  assert.throws(() => verifyPreviewIndex(localHtml, Buffer.concat([localHtml, tag, tag]), deploymentId), /differs beyond/);
  assert.throws(() => verifyPreviewIndex(localHtml, Buffer.concat([tag, localHtml]), deploymentId), /differs beyond/);
});
