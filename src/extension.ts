import * as vscode from "vscode";
import { BinarySizeStatusBarEntry } from "./binarySizeStatusBarEntry";
import { SvgPreviewManager } from "./preview";
import { SizeStatusBarEntry } from "./sizeStatusBarEntry";
import { ZoomStatusBarEntry } from "./zoomStatusBarEntry";

export function activate(context: vscode.ExtensionContext): void {
	const svgSizeStatusBarEntry = new SizeStatusBarEntry();
	context.subscriptions.push(svgSizeStatusBarEntry);

	const svgBinarySizeStatusBarEntry = new BinarySizeStatusBarEntry();
	context.subscriptions.push(svgBinarySizeStatusBarEntry);

	const svgZoomStatusBarEntry = new ZoomStatusBarEntry();
	context.subscriptions.push(svgZoomStatusBarEntry);

	const svgPreviewManager = new SvgPreviewManager(
		context.extensionUri,
		svgSizeStatusBarEntry,
		svgBinarySizeStatusBarEntry,
		svgZoomStatusBarEntry
	);

	context.subscriptions.push(vscode.window.registerCustomEditorProvider(SvgPreviewManager.viewType, svgPreviewManager, {
		supportsMultipleEditorsPerDocument: true
	}));

	context.subscriptions.push(vscode.commands.registerCommand("svgPreview.showPreviewToSide", (uri?: vscode.Uri) => {
		svgPreviewManager.showPreviewToSide(uri);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("svgPreview.showPreview", (uri?: vscode.Uri) => {
		svgPreviewManager.showPreview(uri);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("svgPreview.showSource", (uri?: vscode.Uri) => {
		svgPreviewManager.activePreview?.showSource(uri);
	}));

	context.subscriptions.push(vscode.commands.registerCommand("svgPreview.zoomIn", () => {
		svgPreviewManager.activePreview?.zoomIn();
	}));

	context.subscriptions.push(vscode.commands.registerCommand("svgPreview.zoomOut", () => {
		svgPreviewManager.activePreview?.zoomOut();
	}));

}
