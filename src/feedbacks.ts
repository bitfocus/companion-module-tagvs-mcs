// File: src/feedbacks.ts
import { TAGMCSInstance } from './main.js'
import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'

const COLOR_GREEN = combineRgb(0, 255, 0)
const COLOR_WHITE = combineRgb(255, 255, 255)

export function UpdateFeedbacks(instance: TAGMCSInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {
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
            defaultStyle: {
                color: COLOR_WHITE,
                bgcolor: COLOR_GREEN,
            },
            callback: (feedback) => {
                const outputUuid = feedback.options.useSelectedOutput ? instance.selectedOutput : String(feedback.options.output || '')
                const layoutUuid = feedback.options.useSelectedLayout ? instance.selectedLayout : String(feedback.options.layout || '')

                const output = instance.outputs.find((o) => o.uuid === outputUuid)
                if (!output) {
                    return false
                }

                const currentLayout = output.input.layouts?.[0] || ''
                return currentLayout === layoutUuid
            },
        },
	}

	instance.setFeedbackDefinitions(feedbacks)
}
