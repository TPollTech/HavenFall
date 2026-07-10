'use strict';

const verifiedExtraAssetNames = Object.freeze([
  'res_bones'
]);

for (const name of verifiedExtraAssetNames) {
  if (!assetNames.includes(name)) assetNames.push(name);
}

window.verifiedExtraAssetNames = verifiedExtraAssetNames;
