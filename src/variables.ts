// File: src/variables.ts
import { CompanionVariableDefinition } from '@companion-module/base'
import { TAGMCSInstance } from './main.js'
import { OutputConfig, LayoutConfig } from './types.js'

export function UpdateVariableDefinitions(instance: TAGMCSInstance): void {
	const variables: CompanionVariableDefinition[] = []

	variables.push({ variableId: 'output_count', name: 'Output Count' })
	variables.push({ variableId: 'layout_count', name: 'Layout Count' })
	variables.push({ variableId: 'channel_count', name: 'Channel Count' })

	//selected output, layout, channel
	variables.push({ variableId: 'selected_output', name: 'Selected Output UUID' })
	variables.push({ variableId: 'selected_output_label', name: 'Selected Output Label' })
	variables.push({ variableId: 'selected_layout', name: 'Selected Layout UUID' })
	variables.push({ variableId: 'selected_layout_label', name: 'Selected Layout Label' })

	variables.push({ variableId: 'selected_video_channel', name: 'Selected Video Channel UUID' })
	variables.push({ variableId: 'selected_video_channel_label', name: 'Selected Video Channel Label' })
	variables.push({ variableId: 'selected_audio_channel', name: 'Selected Audio Channel UUID' })
	variables.push({ variableId: 'selected_audio_channel_label', name: 'Selected Audio Channel Label' })

	variables.push({ variableId: 'selected_tile_number', name: 'Selected Tile Number' })

	//loop through outputs and build variables
	for (const output of instance.outputs as OutputConfig[]) {
		variables.push(
			{ variableId: `output_${output.uuid}_label`, name: `Output: ${output.label} Label` },
			{ variableId: `output_${output.uuid}_layout`, name: `Output: ${output.label} Current Layout UUID` },
			{ variableId: `output_${output.uuid}_layout_label`, name: `Output: ${output.label} Current Layout Label` },
			{ variableId: `output_${output.uuid}_audio_channel`, name: `Output: ${output.label} Audio Channel UUID` },
			{ variableId: `output_${output.uuid}_audio_channel_label`, name: `Output: ${output.label} Audio Channel Label` },
			{ variableId: `output_${output.uuid}_mux_audio_pid`, name: `Output: ${output.label} Mux Audio PID` },
		)
	}

	//loop through layouts and build variables
	for (const layout of instance.layouts as LayoutConfig[]) {
		variables.push(
			{ variableId: `layout_${layout.uuid}_label`, name: `Layout: ${layout.label} Label` },
			{ variableId: `layout_${layout.uuid}_tile_count`, name: `Layout: ${layout.label} Tile Count` },
		)

		if (instance.config.enableLayoutVariables == true) {
			// Add variables for each tile in the layout (use .tiles.length if available, otherwise default to 16)
			const tileCount = layout.tiles?.length || 16
			for (let i = 0; i < tileCount; i++) {
				variables.push(
					{ variableId: `layout_${layout.uuid}_tile_${i}_type`, name: `Layout: ${layout.label} Tile ${i} Type` },
					{
						variableId: `layout_${layout.uuid}_tile_${i}_channel`,
						name: `Layout: ${layout.label} Tile ${i} Channel UUID`,
					},
					{
						variableId: `layout_${layout.uuid}_tile_${i}_channel_label`,
						name: `Layout: ${layout.label} Tile ${i} Channel Label`,
					},
					{ variableId: `layout_${layout.uuid}_tile_${i}_text`, name: `Layout: ${layout.label} Tile ${i} Text` },
				)
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

		const layout = instance.layouts.find((l) => l.uuid === output.input.layouts?.[0])
		if (layout) {
			vars[`output_${output.uuid}_layout_label`] = layout.label

			// Also update tile info variables for this layout
			const tileCount = layout.tiles?.length || 16
			vars[`layout_${layout.uuid}_tile_count`] = tileCount
			for (let i = 0; i < tileCount; i++) {
				const tile = layout.tiles ? layout.tiles[i] : undefined
				vars[`layout_${layout.uuid}_tile_${i}_type`] = tile?.type || ''
				vars[`layout_${layout.uuid}_tile_${i}_channel`] = tile?.channel || ''
				vars[`layout_${layout.uuid}_tile_${i}_channel_label`] = getChannelLabel(instance, tile?.channel || '')
				vars[`layout_${layout.uuid}_tile_${i}_text`] = tile?.text || ''
			}
		} else {
			vars[`output_${output.uuid}_layout_label`] = ''
		}
	}

	instance.setVariableValues(vars)
}

function getChannelLabel(instance: TAGMCSInstance, channelUuid: string): string {
	const channel = instance.channels.find((c) => c.uuid === channelUuid)
	return channel ? channel.label : ''
}
