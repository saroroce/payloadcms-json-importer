<img width="2463" height="1167" alt="image" src="https://github.com/user-attachments/assets/c93f136b-c9b2-49c6-adc5-4417f2824d21" />
NPM - https://www.npmjs.com/package/payloadcms-json-importer

# PNPM
```terminal
pnpm add payloadcms-json-importer@latest
```
# NPM
```terminal
npm install payloadcms-json-importer@latest
```
# config
```javascript
import { payloadcmsJsonImporter } from "payloadcms-json-importer";

payloadcmsJsonImporter({
		collections: {
			products: true,
			"product-categories": true,
		},
  }),
```
