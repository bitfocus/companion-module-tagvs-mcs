// File: src/feedbacks.ts
import { TAGMCSInstance } from './main.js'
import { type CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'

const COLOR_GREEN = combineRgb(0, 255, 0)
const COLOR_WHITE = combineRgb(255, 255, 255)

export type FeedbacksSchema = {
	outputLayoutActive: {
		type: 'boolean'
		options: { useSelectedOutput: boolean; output: string; useSelectedLayout: boolean; layout: string }
	}
	outputOnDevice: {
		type: 'boolean'
		options: { useSelectedOutput: boolean; output: string; useSelectedDevice: boolean; device: string }
	}
}

export function UpdateFeedbacks(instance: TAGMCSInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbacksSchema> = {
		outputLayoutActive: {
			type: 'boolean',
			name: 'Layout is Active on Output',
			description: 'If the selected layout is active on the selected output, change color',
			options: [
				{
					type: 'checkbox',
					id: 'useSelectedOutput',
					label: 'Use Selected Output',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
					isVisibleExpression: '!$(options:useSelectedOutput)',
				},
				{
					type: 'checkbox',
					id: 'useSelectedLayout',
					label: 'Use Selected Layout',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'dropdown',
					id: 'layout',
					label: 'Layout',
					default: instance.layoutChoices[0]?.id || '',
					choices: instance.layoutChoices,
					isVisibleExpression: '!$(options:useSelectedLayout)',
				},
			],
			defaultStyle: {
				color: COLOR_WHITE,
				bgcolor: COLOR_GREEN,
			},
			callback: (feedback) => {
				const outputUuid = feedback.options.useSelectedOutput
					? instance.selectedOutput
					: String(feedback.options.output || '')
				const layoutUuid = feedback.options.useSelectedLayout
					? instance.selectedLayout
					: String(feedback.options.layout || '')

				const output = instance.outputs.find((o) => o.uuid === outputUuid)
				if (!output) {
					return false
				}

				const currentLayout = output.input.layouts?.[0] || ''
				return currentLayout === layoutUuid
			},
		},

		outputOnDevice: {
			type: 'boolean',
			name: 'Output is Active on Device',
			description: 'If the selected output is active on the selected device, change color',
			options: [
				{
					type: 'checkbox',
					id: 'useSelectedOutput',
					label: 'Use Selected Output',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'dropdown',
					id: 'output',
					label: 'Output',
					default: instance.outputChoices[0]?.id || '',
					choices: instance.outputChoices,
					isVisibleExpression: '!$(options:useSelectedOutput)',
				},
				{
					type: 'checkbox',
					id: 'useSelectedDevice',
					label: 'Use Selected Device',
					default: false,
					disableAutoExpression: true,
				},
				{
					type: 'dropdown',
					id: 'device',
					label: 'Device',
					default: instance.deviceChoices[0]?.id || '',
					choices: instance.deviceChoices,
					isVisibleExpression: '!$(options:useSelectedDevice)',
				},
			],
			defaultStyle: {
				color: COLOR_WHITE,
				bgcolor: COLOR_GREEN,
			},
			callback: (feedback) => {
				const outputUuid = feedback.options.useSelectedOutput
					? instance.selectedOutput
					: String(feedback.options.output || '')
				const deviceUuid = feedback.options.useSelectedDevice
					? instance.selectedDevice
					: String(feedback.options.device || '')

				const output = instance.outputs.find((o) => o.uuid === outputUuid)
				if (!output) {
					return false
				}

				const currentDevice = output.device || ''
				return currentDevice === deviceUuid
			},
		},
	}

	instance.setFeedbackDefinitions(feedbacks)
}
