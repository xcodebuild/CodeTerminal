/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from 'vs/base/common/errors';
import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import * as network from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { IModelService } from 'vs/editor/common/services/model';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import * as nls from 'vs/nls';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { EditorResolution } from 'vs/platform/editor/common/editor';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { FileOperationError, FileOperationResult } from 'vs/platform/files/common/files';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILabelService } from 'vs/platform/label/common/label';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IEditorPane } from 'vs/workbench/common/editor';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { SideBySideEditorInput } from 'vs/workbench/common/editor/sideBySideEditorInput';
import { TextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { GroupDirection, IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeybindingsEditorInput } from 'vs/workbench/services/preferences/browser/keybindingsEditorInput';
import { FOLDER_SETTINGS_PATH, IKeybindingsEditorOptions, IKeybindingsEditorPane, IOpenSettingsOptions, IPreferencesEditorModel, IPreferencesService, ISetting } from 'vs/workbench/services/preferences/common/preferences';
import { SettingsEditor2Input } from 'vs/workbench/services/preferences/common/preferencesEditorInput';
import { defaultKeybindingsContents, DefaultKeybindingsEditorModel, DefaultRawSettingsEditorModel, DefaultSettings, DefaultSettingsEditorModel, Settings2EditorModel, SettingsEditorModel, WorkspaceConfigurationEditorModel } from 'vs/workbench/services/preferences/common/preferencesModels';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { ITextEditorService } from 'vs/workbench/services/textfile/common/textEditorService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';

export class PreferencesService extends Disposable implements IPreferencesService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDispose = this._register(new Emitter<void>());

	private _defaultUserSettingsContentModel: DefaultSettings | undefined;
	private _defaultWorkspaceSettingsContentModel: DefaultSettings | undefined;
	private _defaultFolderSettingsContentModel: DefaultSettings | undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupService: IEditorGroupsService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@INotificationService private readonly notificationService: INotificationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@ILabelService private readonly labelService: ILabelService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@ICommandService private readonly commandService: ICommandService,
		@ITextEditorService private readonly textEditorService: ITextEditorService,
		@IUriIdentityService private readonly uriService: IUriIdentityService,
	) {
		super();
		// The default keybindings.json updates based on keyboard layouts, so here we make sure
		// if a model has been given out we update it accordingly.
		this._register(keybindingService.onDidUpdateKeybindings(() => {
			const model = modelService.getModel(this.defaultKeybindingsResource);
			if (!model) {
				// model has not been given out => nothing to do
				return;
			}
			modelService.updateModel(model, defaultKeybindingsContents(keybindingService));
		}));
	}

	readonly defaultKeybindingsResource = URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: '/keybindings.json' });
	private readonly defaultSettingsRawResource = URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: '/defaultSettings.json' });

	get userSettingsResource(): URI {
		return this.environmentService.settingsResource;
	}

	get workspaceSettingsResource(): URI | null {
		if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			return null;
		}
		const workspace = this.contextService.getWorkspace();
		return workspace.configuration || workspace.folders[0].toResource(FOLDER_SETTINGS_PATH);
	}

	get settingsEditor2Input(): SettingsEditor2Input {
		return this.instantiationService.createInstance(SettingsEditor2Input);
	}

	getFolderSettingsResource(resource: URI): URI | null {
		const folder = this.contextService.getWorkspaceFolder(resource);
		return folder ? folder.toResource(FOLDER_SETTINGS_PATH) : null;
	}

	resolveModel(uri: URI): ITextModel | null {
		if (this.isDefaultSettingsResource(uri)) {
			// We opened a split json editor in this case,
			// and this half shows the default settings.
			const target = this.getConfigurationTargetFromDefaultSettingsResource(uri);
			const languageSelection = this.languageService.createById('jsonc');
			const model = this._register(this.modelService.createModel('', languageSelection, uri));

			let defaultSettings: DefaultSettings | undefined;
			this.configurationService.onDidChangeConfiguration(e => {
				if (e.source === ConfigurationTarget.DEFAULT) {
					const model = this.modelService.getModel(uri);
					if (!model) {
						// model has not been given out => nothing to do
						return;
					}
					defaultSettings = this.getDefaultSettings(target);
					this.modelService.updateModel(model, defaultSettings.getContentWithoutMostCommonlyUsed(true));
					defaultSettings._onDidChange.fire();
				}
			});

			// Check if Default settings is already created and updated in above promise
			if (!defaultSettings) {
				defaultSettings = this.getDefaultSettings(target);
				this.modelService.updateModel(model, defaultSettings.getContentWithoutMostCommonlyUsed(true));
			}

			return model;
		}

		if (this.defaultSettingsRawResource.toString() === uri.toString()) {
			const defaultRawSettingsEditorModel = this.instantiationService.createInstance(DefaultRawSettingsEditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL));
			const languageSelection = this.languageService.createById('jsonc');
			const model = this._register(this.modelService.createModel(defaultRawSettingsEditorModel.content, languageSelection, uri));
			return model;
		}

		if (this.defaultKeybindingsResource.toString() === uri.toString()) {
			const defaultKeybindingsEditorModel = this.instantiationService.createInstance(DefaultKeybindingsEditorModel, uri);
			const languageSelection = this.languageService.createById('jsonc');
			const model = this._register(this.modelService.createModel(defaultKeybindingsEditorModel.content, languageSelection, uri));
			return model;
		}

		return null;
	}

	public async createPreferencesEditorModel(uri: URI): Promise<IPreferencesEditorModel<ISetting> | null> {
		if (this.isDefaultSettingsResource(uri)) {
			return this.createDefaultSettingsEditorModel(uri);
		}

		if (this.userSettingsResource.toString() === uri.toString()) {
			return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_LOCAL, uri);
		}

		const workspaceSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE);
		if (workspaceSettingsUri && workspaceSettingsUri.toString() === uri.toString()) {
			return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE, workspaceSettingsUri);
		}

		if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
			const settingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, uri);
			if (settingsUri && settingsUri.toString() === uri.toString()) {
				return this.createEditableSettingsEditorModel(ConfigurationTarget.WORKSPACE_FOLDER, uri);
			}
		}

		const remoteEnvironment = await this.remoteAgentService.getEnvironment();
		const remoteSettingsUri = remoteEnvironment ? remoteEnvironment.settingsPath : null;
		if (remoteSettingsUri && remoteSettingsUri.toString() === uri.toString()) {
			return this.createEditableSettingsEditorModel(ConfigurationTarget.USER_REMOTE, uri);
		}

		return null;
	}

	openRawDefaultSettings(): Promise<IEditorPane | undefined> {
		return this.editorService.openEditor({ resource: this.defaultSettingsRawResource });
	}

	openRawUserSettings(): Promise<IEditorPane | undefined> {
		return this.editorService.openEditor({ resource: this.userSettingsResource });
	}

	private shouldOpenJsonByDefault(): boolean {
		return this.configurationService.getValue('workbench.settings.editor') === 'json';
	}

	openSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		options = {
			...options,
			target: ConfigurationTarget.USER_LOCAL,
		};
		if (options.query) {
			options.jsonEditor = false;
		}

		return this.open(this.userSettingsResource, options);
	}

	openLanguageSpecificSettings(languageId: string, options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		if (this.shouldOpenJsonByDefault()) {
			options.query = undefined;
			options.revealSetting = { key: `[${languageId}]`, edit: true };
		} else {
			options.query = `@lang:${languageId}${options.query ? ` ${options.query}` : ''}`;
		}
		options.target = options.target ?? ConfigurationTarget.USER_LOCAL;

		return this.open(this.userSettingsResource, options);
	}

	private open(settingsResource: URI, options: IOpenSettingsOptions): Promise<IEditorPane | undefined> {
		options = {
			...options,
			jsonEditor: options.jsonEditor ?? this.shouldOpenJsonByDefault()
		};

		const {
			fsPath,
		} = settingsResource;
		return this.commandService.executeCommand('revealFileInOS', this.uriService.asCanonicalUri(URI.file(fsPath)));
		// return options.jsonEditor ?
		// 	this.openSettingsJson(settingsResource, options) :
		// 	this.openSettings2(options);
	}

	openUserSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		options = {
			...options,
			target: ConfigurationTarget.USER_LOCAL,
		};
		return this.open(this.userSettingsResource, options);
	}

	async openRemoteSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		const environment = await this.remoteAgentService.getEnvironment();
		if (environment) {
			options = {
				...options,
				target: ConfigurationTarget.USER_REMOTE,
			};

			this.open(environment.settingsPath, options);
		}
		return undefined;
	}

	openWorkspaceSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		if (!this.workspaceSettingsResource) {
			this.notificationService.info(nls.localize('openFolderFirst', "Open a folder or workspace first to create workspace or folder settings."));
			return Promise.reject(null);
		}

		options = {
			...options,
			target: ConfigurationTarget.WORKSPACE
		};
		return this.open(this.workspaceSettingsResource, options);
	}

	async openFolderSettings(options: IOpenSettingsOptions = {}): Promise<IEditorPane | undefined> {
		options = {
			...options,
			target: ConfigurationTarget.WORKSPACE_FOLDER
		};

		if (!options.folderUri) {
			throw new Error(`Missing folder URI`);
		}

		const folderSettingsUri = await this.getEditableSettingsURI(ConfigurationTarget.WORKSPACE_FOLDER, options.folderUri);
		if (!folderSettingsUri) {
			throw new Error(`Invalid folder URI - ${options.folderUri.toString()}`);
		}

		return this.open(folderSettingsUri, options);
	}

	async openGlobalKeybindingSettings(textual: boolean, options?: IKeybindingsEditorOptions): Promise<void> {
		type OpenKeybindingsClassification = {
			textual: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true };
		};
		this.telemetryService.publicLog2<{ textual: boolean }, OpenKeybindingsClassification>('openKeybindings', { textual });

		options = { pinned: true, revealIfOpened: true, ...options };
		if (textual) {
			const emptyContents = '// ' + nls.localize('emptyKeybindingsHeader', "Place your key bindings in this file to override the defaults") + '\n[\n]';
			const editableKeybindings = this.environmentService.keybindingsResource;
			const openDefaultKeybindings = !!this.configurationService.getValue('workbench.settings.openDefaultKeybindings');

			// Create as needed and open in editor
			await this.createIfNotExists(editableKeybindings, emptyContents);
			if (openDefaultKeybindings) {
				const activeEditorGroup = this.editorGroupService.activeGroup;
				const sideEditorGroup = this.editorGroupService.addGroup(activeEditorGroup.id, GroupDirection.RIGHT);
				await Promise.all([
					this.editorService.openEditor({ resource: this.defaultKeybindingsResource, options: { pinned: true, preserveFocus: true, revealIfOpened: true, override: EditorResolution.DISABLED }, label: nls.localize('defaultKeybindings', "Default Keybindings"), description: '' }),
					this.editorService.openEditor({ resource: editableKeybindings, options }, sideEditorGroup.id)
				]);
			} else {
				await this.editorService.openEditor({ resource: editableKeybindings, options });
			}

		} else {
			const editor = (await this.editorService.openEditor(this.instantiationService.createInstance(KeybindingsEditorInput), { ...options, override: EditorResolution.DISABLED })) as IKeybindingsEditorPane;
			if (options.query) {
				editor.search(options.query);
			}
		}

	}

	openDefaultKeybindingsFile(): Promise<IEditorPane | undefined> {
		return this.editorService.openEditor({ resource: this.defaultKeybindingsResource, label: nls.localize('defaultKeybindings', "Default Keybindings") });
	}

	public createSplitJsonEditorInput(configurationTarget: ConfigurationTarget, resource: URI): EditorInput {
		const editableSettingsEditorInput = this.textEditorService.createTextEditor({ resource });
		const defaultPreferencesEditorInput = this.instantiationService.createInstance(TextResourceEditorInput, this.getDefaultSettingsResource(configurationTarget), undefined, undefined, undefined, undefined);
		return this.instantiationService.createInstance(SideBySideEditorInput, editableSettingsEditorInput.getName(), undefined, defaultPreferencesEditorInput, editableSettingsEditorInput);
	}

	public createSettings2EditorModel(): Settings2EditorModel {
		return this.instantiationService.createInstance(Settings2EditorModel, this.getDefaultSettings(ConfigurationTarget.USER_LOCAL));
	}

	private getConfigurationTargetFromDefaultSettingsResource(uri: URI) {
		return this.isDefaultWorkspaceSettingsResource(uri) ?
			ConfigurationTarget.WORKSPACE :
			this.isDefaultFolderSettingsResource(uri) ?
				ConfigurationTarget.WORKSPACE_FOLDER :
				ConfigurationTarget.USER_LOCAL;
	}

	private isDefaultSettingsResource(uri: URI): boolean {
		return this.isDefaultUserSettingsResource(uri) || this.isDefaultWorkspaceSettingsResource(uri) || this.isDefaultFolderSettingsResource(uri);
	}

	private isDefaultUserSettingsResource(uri: URI): boolean {
		return uri.authority === 'defaultsettings' && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?settings\.json$/);
	}

	private isDefaultWorkspaceSettingsResource(uri: URI): boolean {
		return uri.authority === 'defaultsettings' && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?workspaceSettings\.json$/);
	}

	private isDefaultFolderSettingsResource(uri: URI): boolean {
		return uri.authority === 'defaultsettings' && uri.scheme === network.Schemas.vscode && !!uri.path.match(/\/(\d+\/)?resourceSettings\.json$/);
	}

	private getDefaultSettingsResource(configurationTarget: ConfigurationTarget): URI {
		switch (configurationTarget) {
			case ConfigurationTarget.WORKSPACE:
				return URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: `/workspaceSettings.json` });
			case ConfigurationTarget.WORKSPACE_FOLDER:
				return URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: `/resourceSettings.json` });
		}
		return URI.from({ scheme: network.Schemas.vscode, authority: 'defaultsettings', path: `/settings.json` });
	}

	private async createEditableSettingsEditorModel(configurationTarget: ConfigurationTarget, settingsUri: URI): Promise<SettingsEditorModel> {
		const workspace = this.contextService.getWorkspace();
		if (workspace.configuration && workspace.configuration.toString() === settingsUri.toString()) {
			const reference = await this.textModelResolverService.createModelReference(settingsUri);
			return this.instantiationService.createInstance(WorkspaceConfigurationEditorModel, reference, configurationTarget);
		}

		const reference = await this.textModelResolverService.createModelReference(settingsUri);
		return this.instantiationService.createInstance(SettingsEditorModel, reference, configurationTarget);
	}

	private async createDefaultSettingsEditorModel(defaultSettingsUri: URI): Promise<DefaultSettingsEditorModel> {
		const reference = await this.textModelResolverService.createModelReference(defaultSettingsUri);
		const target = this.getConfigurationTargetFromDefaultSettingsResource(defaultSettingsUri);
		return this.instantiationService.createInstance(DefaultSettingsEditorModel, defaultSettingsUri, reference, this.getDefaultSettings(target));
	}

	private getDefaultSettings(target: ConfigurationTarget): DefaultSettings {
		if (target === ConfigurationTarget.WORKSPACE) {
			if (!this._defaultWorkspaceSettingsContentModel) {
				this._defaultWorkspaceSettingsContentModel = new DefaultSettings(this.getMostCommonlyUsedSettings(), target);
			}
			return this._defaultWorkspaceSettingsContentModel;
		}
		if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
			if (!this._defaultFolderSettingsContentModel) {
				this._defaultFolderSettingsContentModel = new DefaultSettings(this.getMostCommonlyUsedSettings(), target);
			}
			return this._defaultFolderSettingsContentModel;
		}
		if (!this._defaultUserSettingsContentModel) {
			this._defaultUserSettingsContentModel = new DefaultSettings(this.getMostCommonlyUsedSettings(), target);
		}
		return this._defaultUserSettingsContentModel;
	}

	public async getEditableSettingsURI(configurationTarget: ConfigurationTarget, resource?: URI): Promise<URI | null> {
		switch (configurationTarget) {
			case ConfigurationTarget.USER:
			case ConfigurationTarget.USER_LOCAL:
				return this.userSettingsResource;
			case ConfigurationTarget.USER_REMOTE: {
				const remoteEnvironment = await this.remoteAgentService.getEnvironment();
				return remoteEnvironment ? remoteEnvironment.settingsPath : null;
			}
			case ConfigurationTarget.WORKSPACE:
				return this.workspaceSettingsResource;
			case ConfigurationTarget.WORKSPACE_FOLDER:
				if (resource) {
					return this.getFolderSettingsResource(resource);
				}
		}
		return null;
	}

	private async createIfNotExists(resource: URI, contents: string): Promise<void> {
		try {
			await this.textFileService.read(resource, { acceptTextOnly: true });
		} catch (error) {
			if ((<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
				try {
					await this.textFileService.write(resource, contents);
					return;
				} catch (error2) {
					throw new Error(nls.localize('fail.createSettings', "Unable to create '{0}' ({1}).", this.labelService.getUriLabel(resource, { relative: true }), getErrorMessage(error2)));
				}
			} else {
				throw error;
			}

		}
	}

	private getMostCommonlyUsedSettings(): string[] {
		return [
			'files.autoSave',
			'editor.fontSize',
			'editor.fontFamily',
			'editor.tabSize',
			'editor.renderWhitespace',
			'editor.cursorStyle',
			'editor.multiCursorModifier',
			'editor.insertSpaces',
			'editor.wordWrap',
			'files.exclude',
			'files.associations',
			'workbench.editor.enablePreview'
		];
	}


	public override dispose(): void {
		this._onDispose.fire();
		super.dispose();
	}
}

registerSingleton(IPreferencesService, PreferencesService);