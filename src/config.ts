import { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	ip: string
	port: number
	username: string
	password: string
	enableLayoutVariables: boolean
	useQueuedCommands: boolean
	queuedCommandDelay: number
	enablePolling: boolean
	pollingRate: number
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'ip',
			label: 'MCS IP Address',
			width: 6,
			default: '',
			required: true,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 6,
			default: 443,
			min: 1,
			max: 65535,
			required: true,
		},
		{
			type: 'static-text',
			id: 'hr1',
			width: 12,
			label: '',
			value: '<hr />',
		},
		{
			type: 'textinput',
			id: 'username',
			label: 'Username',
			width: 6,
			default: '',
			required: true,
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 6,
			default: '',
			required: true,
		},
		{
			type: 'static-text',
			id: 'hr2',
			width: 12,
			label: '',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'enableLayoutVariables',
			label: 'Enable Layout Variables',
			default: false,
			width: 4,
		},
		{
			type: 'static-text',
			id: 'enableLayoutVariablesHelp',
			width: 8,
			label: '',
			value:
				'When enabled, variables will be created for each Layout and its Tiles. This can create a large number of variables depending on the number of layouts and tiles configured in MCS, which could impact performance.',
		},
		{
			type: 'static-text',
			id: 'hr3',
			width: 12,
			label: '',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'useQueuedCommands',
			label: 'Use Queued Commands',
			default: false,
			width: 4,
		},
		{
			type: 'static-text',
			id: 'useQueuedCommandsHelp',
			width: 8,
			label: '',
			value:
				'When enabled, commands will be queued and executed in the order they were received with a delay between each command. This can help prevent overloading the MCS with too many commands at once, which can lead to missed or failed commands.',
		},
		{
			type: 'number',
			id: 'queuedCommandDelay',
			label: 'Queued Command Delay (ms)',
			width: 4,
			default: 800,
			min: 500,
			max: 2000,
			isVisible: (opts) => opts['useQueuedCommands'] === true,
		},
		{
			type: 'static-text',
			id: 'hr4',
			width: 12,
			label: '',
			value: '<hr />',
		},
		{
			type: 'checkbox',
			id: 'enablePolling',
			label: 'Enable Polling',
			default: true,
			width: 6,
		},
		{
			type: 'number',
			id: 'pollingRate',
			label: 'Polling Rate (ms)',
			width: 6,
			default: 5000,
			min: 500,
			max: 3600000,
			required: true,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Mode (log debug output)',
			default: false,
			width: 6,
		},
	]
}
