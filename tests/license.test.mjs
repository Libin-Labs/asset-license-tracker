import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  createAssetLicenseReport,
  renderExportNotices,
  LicenseMetadataError,
} from '../dist/esm/index.js';

const asset = (overrides = {}) => ({
  id: 'hero-image',
  name: 'Hero image',
  license: {
    id: 'vendor-license-v3',
    label: 'Vendor license v3',
    attributionRequired: true,
    attribution: 'Image by Example Artist',
    notice: 'Used with permission',
  },
  restrictions: ['No resale as a standalone asset'],
  ...overrides,
});

test('builds a structured report from caller-supplied license metadata', () => {
  const report = createAssetLicenseReport([asset()]);
  assert.equal(report.assetCount, 1);
  assert.equal(report.entries[0].licenseId, 'vendor-license-v3');
  assert.deepEqual(report.attributions, [
    { assetId: 'hero-image', text: 'Image by Example Artist' },
  ]);
  assert.deepEqual(report.restrictions, [
    {
      assetId: 'hero-image',
      text: 'No resale as a standalone asset',
    },
  ]);
  assert.deepEqual(report.notices, [{ assetId: 'hero-image', text: 'Used with permission' }]);
});

test('renders only the caller-provided attribution and notice text', () => {
  const report = createAssetLicenseReport([asset()]);
  assert.equal(renderExportNotices(report), 'Image by Example Artist\nUsed with permission');
  assert.equal(renderExportNotices(createAssetLicenseReport([])), '');
});

test('supports user-defined identifiers, labels, attribution, and restrictions', () => {
  const report = createAssetLicenseReport([
    asset({
      license: {
        id: 'company-policy-2026',
        label: 'Internal policy label',
        attributionRequired: false,
        attribution: 'Credit supplied by the asset owner',
      },
      restrictions: ['Use only in the launch campaign', 'Do not redistribute the source file'],
    }),
  ]);
  assert.equal(report.entries[0].licenseLabel, 'Internal policy label');
  assert.equal(report.entries[0].attributionRequired, false);
  assert.equal(report.restrictions.length, 2);
});

test('supports empty asset lists and optional notice metadata', () => {
  assert.deepEqual(createAssetLicenseReport([]), {
    assetCount: 0,
    entries: [],
    attributions: [],
    restrictions: [],
    notices: [],
  });
  const report = createAssetLicenseReport([
    asset({
      license: { id: 'custom', label: 'Custom', attributionRequired: false },
      restrictions: [],
    }),
  ]);
  assert.equal(report.entries[0].attribution, undefined);
  assert.equal(renderExportNotices(report), '');
});

test('requires attribution text when caller metadata marks it required', () => {
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: { id: 'custom', label: 'Custom', attributionRequired: true },
        }),
      ]),
    LicenseMetadataError,
  );
});

test('rejects duplicate asset identifiers and preserves distinct assets', () => {
  assert.throws(() => createAssetLicenseReport([asset(), asset()]), /Duplicate asset id/);
  const report = createAssetLicenseReport([
    asset(),
    asset({
      id: 'icon',
      name: 'Icon',
      license: { id: 'custom', label: 'Custom', attributionRequired: false },
      restrictions: [],
    }),
  ]);
  assert.equal(report.assetCount, 2);
});

test('rejects malformed or unknown top-level and nested fields', () => {
  for (const value of [null, {}, [], 'asset']) {
    assert.throws(() => createAssetLicenseReport([value]), LicenseMetadataError);
  }
  assert.throws(() => createAssetLicenseReport([asset({ extra: true })]), /unknown/);
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: {
            id: 'x',
            label: 'X',
            attributionRequired: false,
            extra: true,
          },
        }),
      ]),
    /unknown/,
  );
});

test('rejects empty identifiers, labels, and asset names', () => {
  assert.throws(() => createAssetLicenseReport([asset({ id: ' ' })]), /asset.id/);
  assert.throws(() => createAssetLicenseReport([asset({ name: '' })]), /asset.name/);
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: { id: '', label: 'X', attributionRequired: false },
        }),
      ]),
    /license.id/,
  );
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: { id: 'x', label: '', attributionRequired: false },
        }),
      ]),
    /license.label/,
  );
});

test('validates booleans and optional text rather than coercing values', () => {
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: { id: 'x', label: 'X', attributionRequired: 1 },
        }),
      ]),
    /boolean/,
  );
  assert.throws(
    () =>
      createAssetLicenseReport([
        asset({
          license: {
            id: 'x',
            label: 'X',
            attributionRequired: false,
            notice: 42,
          },
        }),
      ]),
    /notice/,
  );
  assert.throws(() => createAssetLicenseReport([asset({ restrictions: ['   '] })]), /restrictions/);
});

test('rejects malformed restriction lists and duplicate entries', () => {
  for (const restrictions of ['none', null, ['ok', 1], ['same', 'same']]) {
    assert.throws(() => createAssetLicenseReport([asset({ restrictions })]));
  }
});

test('rejects sparse or accessor arrays without invoking accessors', () => {
  const sparse = [];
  sparse[1] = 'restriction';
  assert.throws(() => createAssetLicenseReport([asset({ restrictions: sparse })]), /dense/);
  let calls = 0;
  const restrictions = Object.defineProperty([], '0', {
    enumerable: true,
    get() {
      calls += 1;
      return 'unsafe';
    },
  });
  restrictions.length = 1;
  assert.throws(() => createAssetLicenseReport([asset({ restrictions })]), /dense/);
  assert.equal(calls, 0);
  const assets = [asset()];
  assets.extra = true;
  assert.throws(() => createAssetLicenseReport(assets), /extra properties/);
});

test('enforces asset, text, and per-asset restriction bounds', () => {
  assert.throws(() => createAssetLicenseReport([asset(), asset()], { maxAssets: 1 }), RangeError);
  assert.throws(
    () =>
      createAssetLicenseReport(
        [
          asset({
            id: 'id',
            name: 'long',
            license: { id: 'lic', label: 'x', attributionRequired: false },
            restrictions: [],
          }),
        ],
        { maxTextLength: 3 },
      ),
    /asset.name/,
  );
  assert.throws(
    () =>
      createAssetLicenseReport([asset({ restrictions: ['one', 'two'] })], {
        maxRestrictionsPerAsset: 1,
      }),
    RangeError,
  );
});

test('rejects invalid limits including noninteger and unsafe capacities', () => {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createAssetLicenseReport([], { maxAssets: value }), RangeError);
  }
});

test('rejects class instances, symbol fields, and property accessors', () => {
  class Custom {
    id = 'x';
  }
  assert.throws(() => createAssetLicenseReport([new Custom()]), /plain record/);
  const symbolAsset = { ...asset(), [Symbol('extra')]: true };
  assert.throws(() => createAssetLicenseReport([symbolAsset]), /unknown/);
  let getterCalls = 0;
  const getterAsset = Object.defineProperty(asset(), 'name', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'not read';
    },
  });
  assert.throws(() => createAssetLicenseReport([getterAsset]), /data field/);
  assert.equal(getterCalls, 0);
});

test('does not imply a license database or rewrite supplied restrictions', () => {
  const supplied = 'Restriction text, exact as supplied by the asset owner.';
  const report = createAssetLicenseReport([asset({ restrictions: [supplied] })]);
  assert.equal(report.restrictions[0].text, supplied);
  assert.equal(report.entries[0].licenseId, 'vendor-license-v3');
});

test('validates a report before rendering notices', () => {
  assert.throws(() => renderExportNotices({ entries: [], assetCount: 1 }), LicenseMetadataError);
  let calls = 0;
  const invalid = Object.defineProperty({}, 'entries', {
    enumerable: true,
    get() {
      calls += 1;
      return [];
    },
  });
  assert.throws(() => renderExportNotices(invalid), /non-data field/);
  assert.equal(calls, 0);
});

test('CommonJS entry point exposes the report and notice APIs', () => {
  const require = createRequire(import.meta.url);
  const commonjs = require('../dist/cjs/index.js');
  const report = commonjs.createAssetLicenseReport([asset()]);
  assert.match(commonjs.renderExportNotices(report), /Example Artist/);
});
