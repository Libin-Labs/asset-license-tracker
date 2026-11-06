import {
  createAssetLicenseReport,
  renderExportNotices,
  type LicensedAsset,
} from '@lp-labs/asset-license-tracker';

const assets: LicensedAsset[] = [
  {
    id: 'image-1',
    name: 'Image',
    license: {
      id: 'custom',
      label: 'Custom license',
      attributionRequired: true,
      attribution: 'Artist',
    },
    restrictions: ['Internal use'],
  },
];
console.log(renderExportNotices(createAssetLicenseReport(assets)));
