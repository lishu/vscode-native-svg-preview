//@ts-check

"use strict";

const withNodeDefaults = require("./shared.webpack.config").node;

module.exports = withNodeDefaults({
	context: __dirname,
	resolve: {
		mainFields: ["module", "main"],
		extensions: [".ts", ".js"]
	},
	entry: {
		extension: "./src/extension.ts"
	}
});
