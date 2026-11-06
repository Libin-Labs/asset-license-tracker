# @lp-labs/asset-license-tracker

Create deterministic, machine-readable license metadata reports for assets. All identifiers,
license labels, restrictions, attribution, and notice text come from the caller; this package ships
no license corpus, does not reproduce license texts, and does not give legal advice or determine
license obligations.

## Install and quick start

```sh
npm install @lp-labs/asset-license-tracker
```

```js
import { createAssetLicenseReport, renderExportNotices } from '@lp-labs/asset-license-tracker';

const report = createAssetLicenseReport([
  {
    id: 'hero-photo',
    name: 'Campaign hero photo',
    license: {
      id: 'provider-record-42',
      label: 'Provider-supplied license label',
      attributionRequired: true,
      attribution: 'Photo by Example Artist',
      notice: 'Used under the supplied campaign agreement',
    },
    restrictions: ['Do not redistribute the source file'],
  },
]);
console.log(report.restrictions);
console.log(renderExportNotices(report));
```

## API and types

- `createAssetLicenseReport(assets, limits?)` validates caller-supplied metadata and returns
  `AssetLicenseReport` with entries, attributions, restrictions, and export notices.
- `renderExportNotices(report)` joins only supplied attribution and notice strings, in input order.
- `LicensedAsset` contains `id`, `name`, `license`, and a list of restriction strings.
- `AssetLicenseMetadata` contains a caller-defined license `id` and `label`,
  `attributionRequired`, and optional `attribution` and `notice` text.
- `LicenseReportLimits` bounds asset count, text length, and restrictions per asset.
- `LicenseMetadataError` reports invalid records and missing required attribution.
- Types: `AssetLicenseReport`, `LicenseReportEntry`, and the input/limit types above.

Default limits are 10,000 assets, 4,096 characters per text value, and 100 restrictions per asset.
Limits must be positive safe integers. Identifiers must be unique within one report. A
`attributionRequired` flag is merely reported from caller data; the package does not determine
whether that assertion is correct, interpret restrictions, fetch terms, or verify permissions.
Keep source metadata and any legal review in your own system of record.
Report construction and notice rendering are linear in the asset, restriction, and supplied text
size, bounded by the configured capacities.

## Module formats and customization

ESM, CommonJS, and TypeScript declarations are included. CommonJS:
`const { createAssetLicenseReport } = require('@lp-labs/asset-license-tracker')`. Extend the
caller-owned metadata model in your application and map it into `LicensedAsset`; this API rejects
unknown fields rather than guessing their meaning. No full license text is bundled. There are no
runtime or peer dependencies; TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
