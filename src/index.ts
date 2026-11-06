export interface AssetLicenseMetadata {
  readonly id: string;
  readonly label: string;
  readonly attributionRequired: boolean;
  readonly attribution?: string;
  readonly notice?: string;
}

export interface LicensedAsset {
  readonly id: string;
  readonly name: string;
  readonly license: AssetLicenseMetadata;
  readonly restrictions: readonly string[];
}

export interface LicenseReportLimits {
  readonly maxAssets?: number;
  readonly maxTextLength?: number;
  readonly maxRestrictionsPerAsset?: number;
}

export interface LicenseReportEntry {
  readonly assetId: string;
  readonly assetName: string;
  readonly licenseId: string;
  readonly licenseLabel: string;
  readonly attributionRequired: boolean;
  readonly attribution?: string;
  readonly restrictions: readonly string[];
  readonly notice?: string;
}

export interface AssetLicenseReport {
  readonly assetCount: number;
  readonly entries: readonly LicenseReportEntry[];
  readonly attributions: readonly {
    readonly assetId: string;
    readonly text: string;
  }[];
  readonly restrictions: readonly {
    readonly assetId: string;
    readonly text: string;
  }[];
  readonly notices: readonly {
    readonly assetId: string;
    readonly text: string;
  }[];
}

export class LicenseMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseMetadataError';
  }
}

const defaults = {
  maxAssets: 10_000,
  maxTextLength: 4_096,
  maxRestrictionsPerAsset: 100,
};
const assetKeys = new Set(['id', 'name', 'license', 'restrictions']);
const licenseKeys = new Set(['id', 'label', 'attributionRequired', 'attribution', 'notice']);

function assertRecord(
  value: unknown,
  label: string,
  allowed: ReadonlySet<string>,
  required: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new LicenseMetadataError(`${label} must be a plain record.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      typeof key !== 'string' ||
      !allowed.has(key) ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new LicenseMetadataError(`${label} has an unknown or non-data field.`);
    }
  }
  if (required.some((key) => !Object.hasOwn(value, key))) {
    throw new LicenseMetadataError(`${label} is missing a required field.`);
  }
}

function limitsOf(input: LicenseReportLimits) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new RangeError('License report limits must be a plain record.');
  }
  for (const key of Reflect.ownKeys(input)) {
    const descriptor =
      typeof key === 'string' ? Object.getOwnPropertyDescriptor(input, key) : undefined;
    if (
      !descriptor ||
      !['maxAssets', 'maxTextLength', 'maxRestrictionsPerAsset'].includes(key as string) ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new RangeError('License report limits contain unknown fields.');
    }
  }
  const limits = {
    maxAssets: input.maxAssets ?? defaults.maxAssets,
    maxTextLength: input.maxTextLength ?? defaults.maxTextLength,
    maxRestrictionsPerAsset: input.maxRestrictionsPerAsset ?? defaults.maxRestrictionsPerAsset,
  };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  return limits;
}

function text(value: unknown, name: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) {
    throw new LicenseMetadataError(
      `${name} must be a non-empty string up to ${maximum} characters.`,
    );
  }
  return value;
}

function optionalText(value: unknown, name: string, maximum: number): string | undefined {
  return value === undefined ? undefined : text(value, name, maximum);
}

function validateAsset(value: unknown, limits: ReturnType<typeof limitsOf>): LicenseReportEntry {
  assertRecord(value, 'Asset', assetKeys, ['id', 'name', 'license', 'restrictions']);
  const id = text(value.id, 'asset.id', limits.maxTextLength);
  const assetName = text(value.name, 'asset.name', limits.maxTextLength);
  assertRecord(value.license, 'License metadata', licenseKeys, [
    'id',
    'label',
    'attributionRequired',
  ]);
  const licenseId = text(value.license.id, 'license.id', limits.maxTextLength);
  const licenseLabel = text(value.license.label, 'license.label', limits.maxTextLength);
  if (typeof value.license.attributionRequired !== 'boolean') {
    throw new LicenseMetadataError('license.attributionRequired must be a boolean.');
  }
  const attribution = optionalText(
    value.license.attribution,
    'license.attribution',
    limits.maxTextLength,
  );
  const notice = optionalText(value.license.notice, 'license.notice', limits.maxTextLength);
  if (value.license.attributionRequired && attribution === undefined) {
    throw new LicenseMetadataError('Required attribution text was not supplied.');
  }
  if (
    !Array.isArray(value.restrictions) ||
    value.restrictions.length > limits.maxRestrictionsPerAsset
  ) {
    throw new RangeError('Asset restrictions must be a bounded string array.');
  }
  const restrictions: string[] = [];
  for (let index = 0; index < value.restrictions.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value.restrictions, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new LicenseMetadataError('Restrictions must be dense enumerable data values.');
    }
    restrictions.push(text(descriptor.value, `restrictions[${index}]`, limits.maxTextLength));
  }
  for (const key of Reflect.ownKeys(value.restrictions)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))) {
      throw new LicenseMetadataError('Restrictions cannot have extra properties.');
    }
  }
  if (new Set(restrictions).size !== restrictions.length) {
    throw new LicenseMetadataError('Duplicate restriction entries are not allowed.');
  }
  return {
    assetId: id,
    assetName,
    licenseId,
    licenseLabel,
    attributionRequired: value.license.attributionRequired,
    ...(attribution === undefined ? {} : { attribution }),
    restrictions,
    ...(notice === undefined ? {} : { notice }),
  };
}

export function createAssetLicenseReport(
  assets: readonly LicensedAsset[],
  inputLimits: LicenseReportLimits = {},
): AssetLicenseReport {
  if (!Array.isArray(assets)) throw new LicenseMetadataError('Assets must be an array.');
  const limits = limitsOf(inputLimits);
  if (assets.length > limits.maxAssets) throw new RangeError('Asset count exceeds capacity.');
  const entries: LicenseReportEntry[] = [];
  for (let index = 0; index < assets.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(assets, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new LicenseMetadataError('Assets must be a dense array of enumerable data values.');
    }
    entries.push(validateAsset(descriptor.value, limits));
  }
  for (const key of Reflect.ownKeys(assets)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))) {
      throw new LicenseMetadataError('Asset arrays cannot have extra properties.');
    }
  }
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.assetId))
      throw new LicenseMetadataError(`Duplicate asset id: ${entry.assetId}`);
    ids.add(entry.assetId);
  }
  return {
    assetCount: entries.length,
    entries,
    attributions: entries.flatMap((entry) =>
      entry.attribution === undefined ? [] : [{ assetId: entry.assetId, text: entry.attribution }],
    ),
    restrictions: entries.flatMap((entry) =>
      entry.restrictions.map((restriction) => ({
        assetId: entry.assetId,
        text: restriction,
      })),
    ),
    notices: entries.flatMap((entry) =>
      entry.notice === undefined ? [] : [{ assetId: entry.assetId, text: entry.notice }],
    ),
  };
}

export function renderExportNotices(report: AssetLicenseReport): string {
  assertRecord(
    report,
    'License report',
    new Set(['assetCount', 'entries', 'attributions', 'restrictions', 'notices']),
    ['assetCount', 'entries', 'attributions', 'restrictions', 'notices'],
  );
  if (
    !Array.isArray(report.entries) ||
    !Array.isArray(report.attributions) ||
    !Array.isArray(report.restrictions) ||
    !Array.isArray(report.notices) ||
    !Number.isSafeInteger(report.assetCount) ||
    report.entries.length !== report.assetCount
  ) {
    throw new LicenseMetadataError('A valid report is required.');
  }
  const lines: string[] = [];
  for (let index = 0; index < report.entries.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(report.entries, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      throw new LicenseMetadataError('Report entries must be dense enumerable data values.');
    }
    const entry = descriptor.value;
    assertRecord(
      entry,
      'License report entry',
      new Set([
        'assetId',
        'assetName',
        'licenseId',
        'licenseLabel',
        'attributionRequired',
        'attribution',
        'restrictions',
        'notice',
      ]),
      ['assetId', 'assetName', 'licenseId', 'licenseLabel', 'attributionRequired', 'restrictions'],
    );
    if (
      typeof entry.attributionRequired !== 'boolean' ||
      typeof entry.assetId !== 'string' ||
      typeof entry.assetName !== 'string' ||
      typeof entry.licenseId !== 'string' ||
      typeof entry.licenseLabel !== 'string' ||
      !Array.isArray(entry.restrictions)
    ) {
      throw new LicenseMetadataError('License report entry is malformed.');
    }
    const attribution = entry.attribution;
    const notice = entry.notice;
    if (entry.attributionRequired && attribution === undefined) {
      throw new LicenseMetadataError('Required attribution text is missing from this report.');
    }
    if (attribution !== undefined)
      lines.push(text(attribution, 'attribution', Number.MAX_SAFE_INTEGER));
    if (notice !== undefined) lines.push(text(notice, 'notice', Number.MAX_SAFE_INTEGER));
  }
  return lines.join('\n');
}
