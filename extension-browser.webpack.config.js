//@ts-check

"use strict";

const withBrowserDefaults = require("./shared.webpack.config").browser;

module.exports = withBrowserDefaults({
	context: __dirname,
	entry: {
		extension: "./src/extension.ts"
	}
});
