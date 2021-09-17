import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { PreviewStatusBarEntry } from "./ownedStatusBarEntry";

const localize = nls.loadMessageBundle();

export class SizeStatusBarEntry extends PreviewStatusBarEntry {
	public constructor() {
		super("status.svgPreview.size", localize("sizeStatusBar.name", "Image Size"), vscode.StatusBarAlignment.Right, 101 /* to the left of editor status (100) */);
	}

	public show(owner: string, text: string): void {
		this.showItem(owner, text);
	}
}
