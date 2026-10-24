import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compareBuildFiles, previewForBranch, selectVercelStatus, validateManifest, vercelDeploymentId, verifyPreviewIndex, verifyProjectCases, verifyRun, verifyStoredCode, verifySummary } from '../scripts/testsprite-ci.mjs';

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
