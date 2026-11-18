// File: src/variables.ts
import type { CompanionVariableDefinitions } from '@companion-module/base'
import { TAGMCSInstance } from './main.js'
import { OutputConfig, LayoutConfig } from './types.js'

export function UpdateVariableDefinitions(instance: TAGMCSInstance): void {
	const variables: CompanionVariableDefinitions = {
		output_count: { name: 'Output Count' },
		layout_count: { name: 'Layout Count' },
		channel_count: { name: 'Channel Count' },
		device_count: { name: 'Device Count' },

		//selected output, layout, channel
		selected_output: { name: 'Selected Output UUID' },
		selected_output_label: { name: 'Selected Output Label' },
		selected_layout: { name: 'Selected Layout UUID' },
		selected_layout_label: { name: 'Selected Layout Label' },

		selected_video_channel: { name: 'Selected Video Channel UUID' },
		selected_video_channel_label: { name: 'Selected Video Channel Label' },
		selected_audio_channel: { name: 'Selected Audio Channel UUID' },
		selected_audio_channel_label: { name: 'Selected Audio Channel Label' },

		selected_tile_number: { name: 'Selected Tile Number' },

		selected_device: { name: 'Selected Device UUID' },
		selected_device_label: { name: 'Selected Device Label' },
	}

	//loop through outputs and build variables
	for (const output of instance.outputs as OutputConfig[]) {
		Object.assign(variables, {
			[`output_${output.uuid}_label`]: { name: `Output: ${output.label} Label` },
			[`output_${output.uuid}_layout`]: { name: `Output: ${output.label} Current Layout UUID` },
			[`output_${output.uuid}_layout_label`]: { name: `Output: ${output.label} Current Layout Label` },
			[`output_${output.uuid}_audio_channel`]: { name: `Output: ${output.label} Audio Channel UUID` },
			[`output_${output.uuid}_audio_channel_label`]: { name: `Output: ${output.label} Audio Channel Label` },
			[`output_${output.uuid}_mux_audio_pid`]: { name: `Output: ${output.label} Mux Audio PID` },

			[`output_${output.uuid}_device`]: { name: `Output: ${output.label} Device UUID` },
			[`output_${output.uuid}_device_label`]: { name: `Output: ${output.label} Device Label` },
		})
	}

	//loop through layouts and build variables
	for (const layout of instance.layouts as LayoutConfig[]) {
		variables[`layout_${layout.uuid}_label`] = { name: `Layout: ${layout.label} Label` }
		variables[`layout_${layout.uuid}_tile_count`] = { name: `Layout: ${layout.label} Tile Count` }

		if (instance.config.enableLayoutVariables == true) {
			// Add variables for each tile in the layout (use .tiles.length if available, otherwise default to 16)
			const tileCount = definedTileCount(layout)
			for (let i = 0; i < tileCount; i++) {
				Object.assign(variables, {
					[`layout_${layout.uuid}_tile_${i}_type`]: { name: `Layout: ${layout.label} Tile ${i} Type` },
					[`layout_${layout.uuid}_tile_${i}_number`]: { name: `Layout: ${layout.label} Tile ${i} Tile Number` },
					[`layout_${layout.uuid}_tile_${i}_channel`]: { name: `Layout: ${layout.label} Tile ${i} Channel UUID` },
					[`layout_${layout.uuid}_tile_${i}_channel_label`]: {
						name: `Layout: ${layout.label} Tile ${i} Channel Label`,
					},
					[`layout_${layout.uuid}_tile_${i}_text`]: { name: `Layout: ${layout.label} Tile ${i} Text` },
				})
			}
		}
	}

	instance.setVariableDefinitions(variables)
}

export function UpdateVariables(instance: TAGMCSInstance): void {
	const vars: Record<string, string | number> = {}

	for (const output of instance.outputs) {
		vars[`output_${output.uuid}_label`] = output.label || ''
		vars[`output_${output.uuid}_layout`] = output.input.layouts?.[0] || ''
		vars[`output_${output.uuid}_audio_channel`] = output.input?.audio?.[0]?.channel || ''
		vars[`output_${output.uuid}_mux_audio_pid`] = output.muxing?.audio?.[0]?.pid || ''

		vars[`output_${output.uuid}_device`] = output.device || ''
		vars[`output_${output.uuid}_device_label`] = getDeviceLabel(instance, output.device || '')

		const layout = instance.layouts.find((l) => l.uuid === output.input.layouts?.[0])
		vars[`output_${output.uuid}_layout_label`] = layout ? layout.label : ''
	}

	// every layout, on an output or not, so its tiles can be followed and changed before it is applied
	for (const layout of instance.layouts) {
		const tileCount = definedTileCount(layout)
		vars[`layout_${layout.uuid}_label`] = layout.label || ''
		// blank until the MCS has listed the layout's tiles, rather than a guess
		vars[`layout_${layout.uuid}_tile_count`] = Array.isArray(layout.tiles) ? layout.tiles.length : ''

		// tile variables only exist when layout variables are enabled
		if (instance.config.enableLayoutVariables != true) {
			continue
		}

		for (let i = 0; i < tileCount; i++) {
			const tile = layout.tiles ? layout.tiles[i] : undefined
			vars[`layout_${layout.uuid}_tile_${i}_type`] = tile?.type || ''
			// the Tile Number that Modify Layout takes, which need not be i + 1
			vars[`layout_${layout.uuid}_tile_${i}_number`] = tile?.index ?? ''
			vars[`layout_${layout.uuid}_tile_${i}_channel`] = tile?.channel || ''
			vars[`layout_${layout.uuid}_tile_${i}_channel_label`] = getChannelLabel(instance, tile?.channel || '')
			vars[`layout_${layout.uuid}_tile_${i}_text`] = tile?.text || ''
		}
	}

	instance.setVariableValues(vars)
}

/** How many tile variables a layout gets: its tiles, or 16 while they are not known. */
function definedTileCount(layout: LayoutConfig): number {
	return Array.isArray(layout.tiles) ? layout.tiles.length : 16
}

function getChannelLabel(instance: TAGMCSInstance, channelUuid: string): string {
	const channel = instance.channels.find((c) => c.uuid === channelUuid)
	return channel ? channel.label : ''
}

function getDeviceLabel(instance: TAGMCSInstance, deviceUuid: string): string {
	const device = instance.devices.find((d) => d.uuid === deviceUuid)
	return device ? device.label : ''
}
