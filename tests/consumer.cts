import licenses = require('@lp-labs/asset-license-tracker');

const report = licenses.createAssetLicenseReport([]);
const count: number = report.assetCount;
console.log(count);
