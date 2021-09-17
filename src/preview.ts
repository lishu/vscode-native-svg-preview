import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { Disposable } from "./dispose";
import { SizeStatusBarEntry } from "./sizeStatusBarEntry";
import { Scale, ZoomStatusBarEntry } from "./zoomStatusBarEntry";
import { BinarySizeStatusBarEntry } from "./binarySizeStatusBarEntry";

const localize = nls.loadMessageBundle();

const enum PreviewState {
	Disposed,
	Visible,
	Active,
}

export class SvgPreviewManager implements vscode.CustomReadonlyEditorProvider {
	public static readonly viewType = "svgPreview.previewEditor";
	public resource: vscode.Uri | undefined;

	private readonly _previews = new Set<SvgPreview>();
	private _activePreview: SvgPreview | undefined;

	public constructor(
		private readonly extensionRoot: vscode.Uri,
		private readonly sizeStatusBarEntry: SizeStatusBarEntry,
		private readonly binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
		private readonly zoomStatusBarEntry: ZoomStatusBarEntry,
	) { }

	public async openCustomDocument(uri: vscode.Uri): Promise<{ uri: vscode.Uri; dispose: () => void }> {
		return { dispose: () => { }, uri };
	}

	public async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewEditor: vscode.WebviewPanel,
	): Promise<void> {
		const preview = new SvgPreview(
			this.extensionRoot,
			document.uri,
			webviewEditor,
			this.sizeStatusBarEntry,
			this.binarySizeStatusBarEntry,
			this.zoomStatusBarEntry
		);
		this._previews.add(preview);
		this.setActivePreview(preview);

		webviewEditor.onDidDispose(() => {
			this._previews.delete(preview);
		});

		webviewEditor.onDidChangeViewState(() => {
			if (webviewEditor.active) {
				this.setActivePreview(preview);
			} else if (this._activePreview === preview && !webviewEditor.active) {
				this.setActivePreview(undefined);
			}
		});
	}

	public get activePreview(): SvgPreview | undefined {
		return this._activePreview;
	}

	public showPreview(uri?: vscode.Uri): void {
		const viewColumn = vscode.window.activeTextEditor
			? vscode.ViewColumn.Active
			: vscode.ViewColumn.One;
		if (uri instanceof vscode.Uri) {
			void vscode.commands.executeCommand("vscode.openWith", uri, SvgPreviewManager.viewType, viewColumn);
			return;
		}
		const resource = vscode.window.activeTextEditor?.document.uri;
		if (resource instanceof vscode.Uri) {
			void vscode.commands.executeCommand("vscode.openWith", resource, SvgPreviewManager.viewType, viewColumn);
		}
	}

	public showPreviewToSide(uri?: vscode.Uri): void {
		const viewColumn = vscode.window.activeTextEditor
			? vscode.ViewColumn.Beside
			: vscode.ViewColumn.Two;
		if (uri instanceof vscode.Uri) {
			void vscode.commands.executeCommand("vscode.openWith", uri, SvgPreviewManager.viewType, viewColumn);
			return;
		}
		const resource = vscode.window.activeTextEditor?.document.uri;
		if (resource instanceof vscode.Uri) {
			void vscode.commands.executeCommand("vscode.openWith", resource, SvgPreviewManager.viewType, viewColumn);
		}
	}

	private setActivePreview(value: SvgPreview | undefined): void {
		this._activePreview = value;
		this.setPreviewActiveContext(!!value);
	}

	private setPreviewActiveContext(value: boolean) {
		void vscode.commands.executeCommand("setContext", "svgPreviewFocus", value);
	}
}

class SvgPreview extends Disposable {
	private readonly id: string = `${Date.now()}-${Math.random().toString()}`;
	private readonly emptySvgDataUri = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMSIgd2lkdGg9IjEiPjwvc3ZnPg==";

	private _previewState = PreviewState.Visible;
	private _imageSize: string | undefined;
	private _imageBinarySize: number | undefined;
	private _imageZoom: Scale | undefined;

	public constructor(
		private readonly extensionRoot: vscode.Uri,
		private readonly resource: vscode.Uri,
		public readonly webviewEditor: vscode.WebviewPanel,
		private readonly sizeStatusBarEntry: SizeStatusBarEntry,
		private readonly binarySizeStatusBarEntry: BinarySizeStatusBarEntry,
		private readonly zoomStatusBarEntry: ZoomStatusBarEntry,
	) {
		super();
		const resourceRoot = resource.with({
			path: resource.path.replace(/\/[^\/]+?\.\w+$/, "/"),
		});

		webviewEditor.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				resourceRoot,
				extensionRoot,
			]
		};

		this._register(webviewEditor.webview.onDidReceiveMessage(message => {
			if (!isMessage(message)) {
				return;
			}
			switch (message.type) {
				case "size": {
					this._imageSize = message.value as string;
					this.update();
					break;
				}
				case "zoom": {
					this._imageZoom = message.value as number;
					this.update();
					break;
				}

				case "reopen-as-text": {
					void vscode.commands.executeCommand("vscode.openWith", resource, "default", webviewEditor.viewColumn);
					break;
				}

				case "max-scale": {
					this.setZoomContext("max", message.value as boolean);
					break;
				}

				case "min-scale": {
					this.setZoomContext("min", message.value as boolean);
					break;
				}
			}
		}));

		this._register(this.zoomStatusBarEntry.onDidChangeScale(e => {
			if (this._previewState === PreviewState.Active) {
				void this.webviewEditor.webview.postMessage({
					scale: e.scale,
					type: "setScale"
				});
			}
		}));

		this._register(this.webviewEditor.onDidChangeViewState(() => {
			this.update();
			void this.webviewEditor.webview.postMessage({
				type: "setActive", value: this.webviewEditor.active
			});
		}));

		this._register(this.webviewEditor.onDidDispose(() => {
			if (this._previewState === PreviewState.Active) {
				this.sizeStatusBarEntry.hide(this.id);
				this.binarySizeStatusBarEntry.hide(this.id);
				this.zoomStatusBarEntry.hide(this.id);
			}
			this._previewState = PreviewState.Disposed;
		}));

		const watcher = this._register(vscode.workspace.createFileSystemWatcher(resource.fsPath));
		this._register(watcher.onDidChange(e => {
			if (e.toString() === this.resource.toString()) {
				void this.render();
			}
		}));
		this._register(watcher.onDidDelete(e => {
			if (e.toString() === this.resource.toString()) {
				this.webviewEditor.dispose();
			}
		}));

		void vscode.workspace.fs.stat(resource).then(({ size }) => {
			this._imageBinarySize = size;
			this.update();
		});

		void this.render();
		this.update();
		void this.webviewEditor.webview.postMessage({
			type: "setActive",
			value: this.webviewEditor.active
		});
	}

	public showSource(uri?: vscode.Uri): Thenable<vscode.TextDocument | void> | void {
		if (uri instanceof vscode.Uri) {
			return vscode.workspace.openTextDocument(uri).then(document => {
				void vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
			});
		}
		if (this.resource) {
			return vscode.workspace.openTextDocument(this.resource).then(document => {
				void vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
			});
		}
		return undefined;
	}

	public zoomIn() {
		if (this._previewState === PreviewState.Active) {
			void this.webviewEditor.webview.postMessage({ type: "zoomIn" });
		}
	}

	public zoomOut() {
		if (this._previewState === PreviewState.Active) {
			void this.webviewEditor.webview.postMessage({ type: "zoomOut" });
		}
	}

	public setZoomContext(bound: "min" | "max", value: boolean) {
		switch (bound) {
			case "max":
				void vscode.commands.executeCommand("setContext", "svgPreviewMaxZoom", value);
				break;
			case "min":
				void vscode.commands.executeCommand("setContext", "svgPreviewMinZoom", value);
				break;
		}
	}

	private async render() {
		if (this._previewState !== PreviewState.Disposed) {
			this.webviewEditor.webview.html = await this.getWebviewContents();
		}
	}

	private update() {
		if (this._previewState === PreviewState.Disposed) {
			return;
		}

		if (this.webviewEditor.active) {
			this._previewState = PreviewState.Active;
			this.sizeStatusBarEntry.show(this.id, this._imageSize || "");
			this.binarySizeStatusBarEntry.show(this.id, this._imageBinarySize);
			this.zoomStatusBarEntry.show(this.id, this._imageZoom || "fit");
		} else {
			if (this._previewState === PreviewState.Active) {
				this.sizeStatusBarEntry.hide(this.id);
				this.binarySizeStatusBarEntry.hide(this.id);
				this.zoomStatusBarEntry.hide(this.id);
			}
			this._previewState = PreviewState.Visible;
		}
	}

	private async getWebviewContents(): Promise<string> {
		const version = Date.now().toString();

		const settings = {
			isMac: isMac(),
			src: await this.getResourcePath(this.webviewEditor, this.resource, version),
		};

		const nonce = getNonce();

		const cspSource = this.webviewEditor.webview.cspSource;

		return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">

	<!-- Disable pinch zooming -->
	<meta name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">

	<title>SVG Preview</title>

	<link rel="stylesheet" href="${escapeAttribute(this.extensionResource("/media/main.css"))}" type="text/css" media="screen" nonce="${nonce}">

	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; script-src 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}';">
	<meta id="svg-preview-settings" data-settings="${escapeAttribute(JSON.stringify(settings))}">
</head>
<body class="container svg scale-to-fit loading">
	<div class="loading-indicator"></div>
	<div class="svg-load-error">
		<p>${localize("preview.svgLoadError", "An error occurred while loading the SVG.")}</p>
		<a href="#" class="open-file-link">${localize("preview.svgLoadErrorLink", "Open file using VS Code's standard text/binary editor?")}</a>
	</div>
	<script src="${escapeAttribute(this.extensionResource("/media/main.js"))}" nonce="${nonce}"></script>
</body>
</html>`;
	}

	private async getResourcePath(webviewEditor: vscode.WebviewPanel, resource: vscode.Uri, version: string): Promise<string> {
		if (resource.scheme === "git") {
			const stat = await vscode.workspace.fs.stat(resource);
			if (stat.size === 0) {
				return this.emptySvgDataUri;
			}
		}

		// Avoid adding cache busting if there is already a query string
		if (resource.query) {
			return webviewEditor.webview.asWebviewUri(resource).toString();
		}
		return webviewEditor.webview.asWebviewUri(resource).with({ query: `version=${version}` }).toString();
	}

	private extensionResource(path: string) {
		return this.webviewEditor.webview.asWebviewUri(this.extensionRoot.with({
			path: this.extensionRoot.path + path
		}));
	}
}

interface WebviewMessage extends Record<string, unknown> {
	type: string;
	value?: string | number | boolean;
}

function isMessage(m: Record<string, unknown>): m is WebviewMessage {
	return (
		typeof m === "object" &&
		typeof m.type === "string"
	);
}

declare const process: undefined | { readonly platform: string };

function isMac(): boolean {
	if (typeof process === "undefined") {
		return false;
	}
	return process.platform === "darwin";
}

function escapeAttribute(value: string | vscode.Uri): string {
	return value.toString().replace(/"/g, "&quot;");
}

function getNonce() {
	let text = "";
	const possible = "abcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 64; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
