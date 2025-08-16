// File: src/actions.ts
import { TAGMCSInstance } from './main.js'
import { CompanionActionDefinitions } from '@companion-module/base'
import { fetchJson, applyLayout } from './api.js'

export function UpdateActions(instance: TAGMCSInstance): void {
	const actions: CompanionActionDefinitions = {
		selectOutput: {
			name: 'Select Output',
			options: [
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
				},
			],
			callback: async (evt) => {
				const outputUuid = String(evt.options.output || '')
				if (!outputUuid) {
					instance.log('error', 'select_output: output is required')
					return
				}

				instance.selectedOutput = outputUuid
				const outputChoice = instance.outputChoices.find((o) => o.id === outputUuid)
				const outputLabel = outputChoice ? outputChoice.label : ''

				instance.setVariableValues({
					selected_output: outputUuid,
					selected_output_label: outputLabel,
				})
			},
		},
		selectLayout: {
			name: 'Select Layout',
			options: [
				{
					type: 'dropdown',
					id: 'layout',
					label: 'Layout',
					default: instance.layoutChoices[0]?.id || '',
					choices: instance.layoutChoices,
				},
			],
			callback: async (evt) => {
				const layoutUuid = String(evt.options.layout || '')
				if (!layoutUuid) {
					instance.log('error', 'select_layout: layout is required')
					return
				}

				instance.selectedLayout = layoutUuid
				const layoutChoice = instance.layoutChoices.find((o) => o.id === layoutUuid)
				const layoutLabel = layoutChoice ? layoutChoice.label : ''

				instance.setVariableValues({
					selected_layout: layoutUuid,
					selected_layout_label: layoutLabel,
				})
			},
		},

		applyLayout: {
			name: 'Apply Layout to Output',
			options: [
				{
					type: 'checkbox',
					id: 'useSelectedOutput',
					label: 'Use Selected Output',
					default: false,
				},
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
					isVisible: (opts) => opts['useSelectedOutput'] !== true,
				},
				{
					type: 'checkbox',
					id: 'useSelectedLayout',
					label: 'Use Selected Layout',
					default: false,
				},
				{
					type: 'dropdown',
					id: 'layout',
					label: 'Layout',
					default: instance.layoutChoices[0]?.id || '',
					choices: instance.layoutChoices,
					isVisible: (opts) => opts['useSelectedLayout'] !== true,
				},
			],
			callback: async (evt) => {
				const outputUuid = evt.options.useSelectedOutput ? instance.selectedOutput : String(evt.options.output || '')
				const layoutUuid = evt.options.useSelectedLayout ? instance.selectedLayout : String(evt.options.layout || '')

				await applyLayout(instance, outputUuid, layoutUuid)
			},
		},

		changeAudioChannel: {
			name: 'Change Audio Channel for Output',
			options: [
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
				},
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Audio Channel',
					default: instance.channelChoices[0]?.id || '',
					choices: instance.channelChoices,
				},
				{
					type: 'number',
					id: 'audio_index',
					label: 'Audio Index (1 = first PID)',
					default: 1,
					min: 1,
					max: 64,
					step: 1,
				},
			],
			callback: async (evt) => {
				const outputUuid = String(evt.options.output || '')
				const channelUuid = String(evt.options.channel || '')
				const audioIndex = Number(evt.options.audio_index ?? 1)

				if (!outputUuid || !channelUuid) {
					instance.log('error', 'change_audio_channel: output and channel are required')
					return
				}

				//find current from instance.outputs based on outputUuid
				const current = instance.outputs.find((o: any) => o.uuid === outputUuid)
				if (!current) {
					instance.log('error', `change_audio_channel: output ${outputUuid} not found`)
					return
				}

				// 2) Ensure input/audio[0] exists, then update channel + audio_index
				const next = { ...current }

				if (!next.input) next.input = {}
				if (!next.input.audio || !Array.isArray(next.input.audio)) next.input.audio = []

				// Find index 1 entry (TAG notes there are up to 32; we only care about index 1)
				const idx = next.input.audio.findIndex((a: any) => a && a.index === 1)
				const entry = {
					index: 1,
					channel: channelUuid,
					audio_pid: null, // leave null when using audio_index
					audio_index: audioIndex > 0 ? audioIndex : 1,
				}

				if (idx >= 0) {
					next.input.audio[idx] = { ...next.input.audio[idx], ...entry }
				} else {
					next.input.audio.push(entry)
				}

				// 3) PUT full output config back
				await fetchJson(instance as any, `outputs/config/${outputUuid}`, 'PUT', next)

				if (instance.config.verbose === true) {
					instance.log(
						'debug',
						`Changed audio to channel ${channelUuid} (audio_index=${audioIndex}) on output ${outputUuid}`,
					)
				}
			},
		},
	}

	instance.setActionDefinitions(actions)
}
