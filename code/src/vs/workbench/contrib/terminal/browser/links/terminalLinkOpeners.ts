/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OperatingSystem } from 'vs/base/common/platform';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITerminalLinkOpener, ITerminalSimpleLink } from 'vs/workbench/contrib/terminal/browser/links/links';
import { ILineColumnInfo } from 'vs/workbench/contrib/terminal/browser/links/terminalLinkManager';
import { getLocalLinkRegex, lineAndColumnClause, lineAndColumnClauseGroupCount, unixLineAndColumnMatchIndex, winLineAndColumnMatchIndex } from 'vs/workbench/contrib/terminal/browser/links/terminalLocalLinkDetector';
import * as open from 'open';


async function openLink(link: ITerminalSimpleLink) {
	if (!link.uri) {
		throw new Error('Tried to open a url without a resolved URI');
	}
	await open(link.uri.toString());
}

export class TerminalLocalFileLinkOpener implements ITerminalLinkOpener {
	constructor(
		private readonly _os: OperatingSystem,
	) {
	}

	async open(link: ITerminalSimpleLink): Promise<void> {
		return await openLink(link);
	}

	/**
	 * Returns line and column number of URl if that is present, otherwise line 1 column 1.
	 *
	 * @param link Url link which may contain line and column number.
	 */
	extractLineColumnInfo(link: string): ILineColumnInfo {
		const matches: string[] | null = getLocalLinkRegex(this._os).exec(link);
		const lineColumnInfo: ILineColumnInfo = {
			lineNumber: 1,
			columnNumber: 1
		};

		if (!matches) {
			return lineColumnInfo;
		}

		const lineAndColumnMatchIndex = this._os === OperatingSystem.Windows ? winLineAndColumnMatchIndex : unixLineAndColumnMatchIndex;
		for (let i = 0; i < lineAndColumnClause.length; i++) {
			const lineMatchIndex = lineAndColumnMatchIndex + (lineAndColumnClauseGroupCount * i);
			const rowNumber = matches[lineMatchIndex];
			if (rowNumber) {
				lineColumnInfo['lineNumber'] = parseInt(rowNumber, 10);
				// Check if column number exists
				const columnNumber = matches[lineMatchIndex + 2];
				if (columnNumber) {
					lineColumnInfo['columnNumber'] = parseInt(columnNumber, 10);
				}
				break;
			}
		}

		return lineColumnInfo;
	}
}

export class TerminalLocalFolderInWorkspaceLinkOpener implements ITerminalLinkOpener {
	constructor(@ICommandService private readonly _commandService: ICommandService) {
	}

	async open(link: ITerminalSimpleLink): Promise<void> {
		if (!link.uri) {
			throw new Error('Tried to open folder in workspace link without a resolved URI');
		}
		await this._commandService.executeCommand('revealInExplorer', link.uri);
	}
}

export class TerminalLocalFolderOutsideWorkspaceLinkOpener implements ITerminalLinkOpener {
	constructor() {
	}

	async open(link: ITerminalSimpleLink): Promise<void> {
		return await openLink(link);
	}
}

export class TerminalSearchLinkOpener implements ITerminalLinkOpener {
	constructor(
	) {
	}

	async open(link: ITerminalSimpleLink): Promise<void> {
		return await openLink(link);
	}

}

export class TerminalUrlLinkOpener implements ITerminalLinkOpener {
	constructor(
		private readonly _isRemote: boolean,
		@IOpenerService private readonly _openerService: IOpenerService,
	) {
	}

	async open(link: ITerminalSimpleLink): Promise<void> {
		if (!link.uri) {
			throw new Error('Tried to open a url without a resolved URI');
		}
		// It's important to use the raw string value here to avoid converting pre-encoded values
		// from the URL like `%2B` -> `+`.
		this._openerService.open(link.text, {
			allowTunneling: this._isRemote,
			allowContributedOpeners: true,
		});
	}
}
