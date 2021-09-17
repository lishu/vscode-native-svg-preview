import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { PreviewStatusBarEntry } from "./ownedStatusBarEntry";

const localize = nls.loadMessageBundle();

class BinarySize {
	public static readonly kb = 1024;
	public static readonly mb = BinarySize.kb * BinarySize.kb;
	public static readonly gb = BinarySize.mb * BinarySize.kb;
	public static readonly tb = BinarySize.gb * BinarySize.kb;

	public static formatSize(size: number): string {
		if (size < BinarySize.kb) {
			return localize("sizeB", "{0}B", size);
		}

		if (size < BinarySize.mb) {
			return localize("sizeKB", "{0}KB", (size / BinarySize.kb).toFixed(2));
		}

		if (size < BinarySize.gb) {
			return localize("sizeMB", "{0}MB", (size / BinarySize.mb).toFixed(2));
		}

		if (size < BinarySize.tb) {
			return localize("sizeGB", "{0}GB", (size / BinarySize.gb).toFixed(2));
		}

		return localize("sizetb", "{0}tb", (size / BinarySize.tb).toFixed(2));
	}
}

export class BinarySizeStatusBarEntry extends PreviewStatusBarEntry {
	public constructor() {
		super(
			"status.svgPreview.binarySize",
			localize("sizeStatusBar.name", "Image Binary Size"),
			vscode.StatusBarAlignment.Right,
			100
		);
	}

	public show(owner: string, size: number | undefined): void {
		if (typeof size === "number") {
			super.showItem(owner, BinarySize.formatSize(size));
		} else {
			this.hide(owner);
		}
	}
}
