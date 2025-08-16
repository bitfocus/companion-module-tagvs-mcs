import { InstanceBase, runEntrypoint, type SomeCompanionConfigField } from '@companion-module/base'

import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'

import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions, UpdateVariables } from './variables.js'

import { InitConnection, StopPolling } from './api.js'

export class TAGMCSInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()

	pollInterval: NodeJS.Timeout | undefined = undefined // Interval for polling data
	baseUrl: string = '' // Base URL for the TAG MCS API

	outputs: any[] = [] // Cached outputs from the API
	layouts: any[] = [] // Cached layouts from the API
	channels: any[] = [] // Cached audio channels from the API

	outputChoices: Array<{ id: string; label: string }> = []
	layoutChoices: Array<{ id: string; label: string }> = []
	channelChoices: Array<{ id: string; label: string }> = []

	selectedOutput: string = ''
	selectedLayout: string = ''
	selectedChannel: string = ''

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		await this.initConnection()
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		StopPolling(this) // Stop any ongoing polling
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		await this.initConnection()
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updateVariables(): void {
		UpdateVariables(this)
	}

	async initConnection(): Promise<void> {
		await InitConnection(this)
	}
}

runEntrypoint(TAGMCSInstance, UpgradeScripts)
