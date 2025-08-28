import { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	ip: string
	port: number
	username: string
	password: string
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
