import * as vscode from "vscode";
import { Disposable } from "./dispose";

export abstract class PreviewStatusBarEntry extends Disposable {
	protected readonly entry: vscode.StatusBarItem;
	private _showOwner: string | undefined;

	public constructor(id: string, name: string, alignment: vscode.StatusBarAlignment, priority: number) {
		super();
		this.entry = this._register(vscode.window.createStatusBarItem(id, alignment, priority));
		this.entry.name = name;
	}

	public hide(owner: string): void {
		if (owner === this._showOwner) {
			this.entry.hide();
			this._showOwner = undefined;
		}
	}

	protected showItem(owner: string, text: string): void {
		this._showOwner = owner;
		this.entry.text = text;
		this.entry.show();
	}
}
