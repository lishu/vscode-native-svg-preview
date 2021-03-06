//@ts-check
/** @typedef {import("webpack").Configuration} WebpackConfig **/

"use strict";

const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { NLSBundlePlugin } = require("vscode-nls-dev/lib/webpack-bundler");
const { DefinePlugin } = require("webpack");

function withNodeDefaults(/**@type WebpackConfig*/extConfig) {
	/** @type WebpackConfig */
	let defaultConfig = {
		mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to "production")
		target: "node", // extensions run in a node context
		node: {
			__dirname: false // leave the __dirname-behaviour intact
		},
		resolve: {
			mainFields: ["module", "main"],
			extensions: [".ts", ".js"] // support ts-files and js-files
		},
		module: {
			rules: [{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{
					// vscode-nls-dev loader:
					// * rewrite nls-calls
					loader: "vscode-nls-dev/lib/webpack-loader",
					options: {
						base: path.join(extConfig.context, "src")
					}
				}, {
					// configure TypeScript loader:
					// * enable sources maps for end-to-end source maps
					loader: "ts-loader",
					options: {
						compilerOptions: {
							"sourceMap": true,
						}
					}
				}]
			}]
		},
		externals: {
			"vscode": "commonjs vscode"
		},
		output: {
			// all output goes into `dist`.
			// packaging depends on that and this must always be like it
			filename: "[name].js",
			path: path.join(extConfig.context, "dist"),
			libraryTarget: "commonjs",
		},
		// yes, really source maps
		devtool: "source-map",
		plugins: nodePlugins(extConfig.context),
	};

	return Object.assign({}, defaultConfig, extConfig);
}

function nodePlugins(context) {
	// Need to find the top-most `package.json` file
	const folderName = path.relative(__dirname, context).split(/[\\\/]/)[0];
	const pkgPath = path.join(__dirname, folderName, "package.json");
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
	const id = `${pkg.publisher}.${pkg.name}`;
	return [
		new CopyWebpackPlugin({
			patterns: [
				{ from: "src", to: ".", globOptions: { ignore: ["**/test/**", "**/*.ts"] }, noErrorOnMissing: true }
			]
		}),
		new NLSBundlePlugin(id)
	];
}
/**
 * @typedef {{
 * 	configFile?: string
 * }} AdditionalBrowserConfig
 */

function withBrowserDefaults(/**@type WebpackConfig*/extConfig, /** @type AdditionalBrowserConfig */ additionalOptions = {}) {
	/** @type WebpackConfig */
	let defaultConfig = {
		mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to "production")
		target: "webworker", // extensions run in a webworker context
		resolve: {
			mainFields: ["browser", "module", "main"],
			extensions: [".ts", ".js"], // support ts-files and js-files
			fallback: {
				"path": require.resolve("path-browserify"),
				"util": require.resolve("util")
			}
		},
		module: {
			rules: [{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{
					// configure TypeScript loader:
					// * enable sources maps for end-to-end source maps
					loader: "ts-loader",
					options: {
						compilerOptions: {
							"sourceMap": true,
						},
						...(additionalOptions ? {} : { configFile: additionalOptions.configFile })
					}
				}]
			}]
		},
		externals: {
			"vscode": "commonjs vscode"
		},
		performance: {
			hints: false
		},
		output: {
			// all output goes into `dist`.
			// packaging depends on that and this must always be like it
			filename: "[name].js",
			path: path.join(extConfig.context, "dist", "browser"),
			libraryTarget: "commonjs",
		},
		// yes, really source maps
		devtool: "source-map",
		plugins: browserPlugins
	};

	return Object.assign({}, defaultConfig, extConfig);
}

const browserPlugins = [
	new CopyWebpackPlugin({
		patterns: [
			{ from: "src", to: ".", globOptions: { ignore: ["**/test/**", "**/*.ts"] }, noErrorOnMissing: true }
		]
	}),
	new DefinePlugin({
		"process.env": JSON.stringify({}),
		"process.env.BROWSER_ENV": JSON.stringify("true")
	})
];

module.exports = withNodeDefaults;
module.exports.node = withNodeDefaults;
module.exports.browser = withBrowserDefaults;
module.exports.nodePlugins = nodePlugins;
module.exports.browserPlugins = browserPlugins;
