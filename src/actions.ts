// File: src/actions.ts
import { TAGMCSInstance } from './main.js'
import { CompanionActionDefinitions } from '@companion-module/base'
import { modifyLayout, applyLayout, setAudioChannel } from './api.js'

export function UpdateActions(instance: TAGMCSInstance): void {
	const actions: CompanionActionDefinitions = {
		selectOutput: {
			name: 'Select Output',
			description: 'Select an Output to use in other actions.',
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
			description: 'Select a Layout to use in other actions.',
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

				instance.selectedLayout = layoutUuid
				const layoutChoice = instance.layoutChoices.find((o) => o.id === layoutUuid)
				const layoutLabel = layoutChoice ? layoutChoice.label : ''

				instance.setVariableValues({
					selected_layout: layoutUuid,
					selected_layout_label: layoutLabel,
				})
			},
		},

		selectVideoChannel: {
			name: 'Select Video Channel',
			description: 'Select a Video Channel to use in other actions.',
			options: [
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Video Channel',
					default: instance.channelChoices[0]?.id || '',
					choices: instance.channelChoices,
				},
			],
			callback: async (evt) => {
				const channelUuid = String(evt.options.channel || '')

				instance.selectedVideoChannel = channelUuid
				const channelChoice = instance.channelChoices.find((o) => o.id === channelUuid)
				const channelLabel = channelChoice ? channelChoice.label : ''

				instance.setVariableValues({
					selected_video_channel: channelUuid,
					selected_video_channel_label: channelLabel,
				})
			},
		},

		selectAudioChannel: {
			name: 'Select Audio Channel',
			description: 'Select an Audio Channel to use in other actions.',
			options: [
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Audio Channel',
					default: instance.channelChoices[0]?.id || '',
					choices: instance.channelChoices,
				},
			],
			callback: async (evt) => {
				const channelUuid = String(evt.options.channel || '')

				instance.selectedAudioChannel = channelUuid
				const channelChoice = instance.channelChoices.find((o) => o.id === channelUuid)
				const channelLabel = channelChoice ? channelChoice.label : ''

				instance.setVariableValues({
					selected_audio_channel: channelUuid,
					selected_audio_channel_label: channelLabel,
				})
			},
		},

		selectTileNumber: {
			name: 'Select Tile Number',
			description: 'Select a Tile Number to use in other actions.',
			options: [
				{
					type: 'textinput',
					id: 'tileNumber',
					label: 'Tile Number',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (evt) => {
				const tileNumber = Number(await instance.parseVariablesInString(String(evt.options.tileNumber) ?? '1'))

				if (tileNumber < 1 || tileNumber > 64) {
					instance.log('error', 'selectTileNumber: tile number must be between 1 and 64')
					return
				}
				instance.setVariableValues({
					selected_tile_number: tileNumber,
				})

				instance.selectedTileNumber = tileNumber
			},
		},

		modifyLayout: {
			name: 'Modify Layout',
			description: 'Modify a layout by changing the Video Channel assigned to a Tile Number.',
			options: [
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
				{
					type: 'checkbox',
					id: 'useSelectedTileNumber',
					label: 'Use Selected Tile Number',
					default: false,
				},
				{
					type: 'textinput',
					id: 'tileNumber',
					label: 'Tile Number',
					default: '1',
					useVariables: true,
					isVisible: (opts) => opts['useSelectedTileNumber'] !== true,
				},
				{
					type: 'checkbox',
					id: 'useSelectedVideoChannel',
					label: 'Use Selected Video Channel',
					default: false,
				},
				{
					type: 'dropdown',
					id: 'videoChannel',
					label: 'Video Channel',
					default: instance.channelChoices[0]?.id || '',
					choices: instance.channelChoices,
					isVisible: (opts) => opts['useSelectedVideoChannel'] !== true,
				},
				{
					type: 'checkbox',
					id: 'applytoOutput',
					label: 'Apply Modified Layout to Output',
					default: false,
				},
				{
					type: 'checkbox',
					id: 'useSelectedOutput',
					label: 'Use Selected Output',
					default: false,
					isVisible: (opts) => opts['applytoOutput'] === true,
				},
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
					isVisible: (opts) => opts['applytoOutput'] === true && opts['useSelectedOutput'] !== true,
				},
			],
			callback: async (evt) => {
				const layoutUuid = evt.options.useSelectedLayout ? instance.selectedLayout : String(evt.options.layout || '')
				const tileNumber = evt.options.useSelectedTileNumber
					? instance.selectedTileNumber
					: Number(await instance.parseVariablesInString(String(evt.options.tileNumber)))
				const videoChannelUuid = evt.options.useSelectedVideoChannel
					? instance.selectedVideoChannel
					: String(evt.options.videoChannel || '')
				if (tileNumber < 1 || tileNumber > 64) {
					instance.log('error', 'modifyLayout: tile number must be between 1 and 64')
					return
				}
				await modifyLayout(instance, layoutUuid, tileNumber, videoChannelUuid)

				// If applytoOutput is true, apply the modified layout to the selected output
				if (evt.options.applytoOutput) {
					//might need to wait for the layout to be modified before applying it for a few ms here
					await new Promise((resolve) => setTimeout(resolve, 100))

					const outputUuid = String(evt.options.output || '')
					await applyLayout(instance, outputUuid, layoutUuid)
				}
			},
		},

		applyLayout: {
			name: 'Apply Layout to Output',
			description: 'Assign a layout to an output. These can either be chosen from a list or using the pre-selected Output or Layout.',
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
			description: 'Change the Audio Channel for an Output. This can either be chosen from a list or using the pre-selected Output and Audio Channel.',
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
					id: 'useSelectedAudioChannel',
					label: 'Use Selected Audio Channel',
					default: false,
				},
				{
					type: 'dropdown',
					id: 'channel',
					label: 'Audio Channel',
					default: instance.channelChoices[0]?.id || '',
					choices: instance.channelChoices,
					isVisible: (opts) => opts['useSelectedAudioChannel'] !== true,
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
				const outputUuid = evt.options.useSelectedOutput
					? instance.selectedOutput
					: String(evt.options.output || '')

				const channelUuid = evt.options.useSelectedAudioChannel
					? instance.selectedAudioChannel
					: String(evt.options.channel || '')
				const audioIndex = Number(evt.options.audio_index ?? 1)

				await setAudioChannel(instance, outputUuid, channelUuid, audioIndex)
			},
		},
	}

	instance.setActionDefinitions(actions)
}
