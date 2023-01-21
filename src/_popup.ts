import { defaults, isCssSetting } from './settings.js'
import { withActiveTab } from './helpers.js'

import type { CssSetting, Setting, Settings } from './settings.js'

type ValueOf<T> = T[keyof T]

// FIXME: Replace with just a cast at the time of use.
// NOTE: Only use on literal readonly objects
function typedEntries<O extends object>(from: O): [keyof O, ValueOf<O>][] {
	return Object.entries(from) as [keyof O, ValueOf<O>][]
}

type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P]
}

type StringSetting<T = Settings> = keyof PickByType<T, string>
type StringSettingValidity = `${StringSetting}-validity`
type ValidStringSettingId = StringSettingValidity & ExistingGeneralElements


function makeSimpleChangeHandler(
	input: HTMLInputElement, prop: keyof HTMLInputElement, setting: Setting
) {
	input.addEventListener('change', function() {
		chrome.storage.sync.set({ [setting]: input[prop] })
	})
}

function makeValidityChangeHandler(input: HTMLInputElement, setting: CssSetting) {
	input.addEventListener('change', function() {
		const validity = isValidCss(setting, input.value)
		if (validity !== false) {
			chrome.storage.sync.set({ [setting]: input.value.trim() })
		}
		showValidity(setting, validity)
	})
}

function isValidCss(property: CssSetting, proposed: string) {
	if (proposed === '') return false
	const test = document.createElement('div')
	test.style[property] = proposed
	// NOTE: Good enough, prob :-)
	const valid = test.style[property] !== ''
	test.remove()
	return valid
}

function showValidity(setting: StringSetting, validity: boolean) {
	const id: ValidStringSettingId = `${setting}-validity`
	const element = document.getElementById(id)
	switch (validity) {
		case true: element.className = 'validity-valid'
			break
		case false: element.className = 'validity-invalid'
			break
		default: throw Error(`Unexpected validity: "${validity}"`)
	}
	document.getElementById(setting).setAttribute(
		'aria-invalid', String(validity === false))
}

function reflectOnState(onState: boolean) {
	const onCheckbox = document.getElementById('on')
	const disabledState = !onState
	for (const control of document.querySelectorAll('input')) {
		if (control !== onCheckbox) control.disabled = disabledState
	}
	if (onState) document.getElementById('locator').focus()
}

chrome.storage.sync.get(defaults, items => {
	reflectOnState(items.on)
	document.getElementById(items.on ? 'locator' : 'on').focus()

	let setting: keyof typeof defaults
	for (setting in defaults) {
		const input = document.getElementById(setting)
		if (typeof defaults[setting] === 'boolean') {
			input.checked = items[setting]
			makeSimpleChangeHandler(input, 'checked', setting)
		} else if (isCssSetting(setting)) {
			input.value = items[setting]
			showValidity(setting, isValidCss(setting, input.value))
			makeValidityChangeHandler(input, setting)
		} else {
			input.value = items[setting]
			makeSimpleChangeHandler(input, 'value', setting)
		}
	}
})

chrome.runtime.onMessage.addListener((message, sender) => {
	switch (message.name) {
		case 'mutations':
		case 'runs':
			document.getElementById(message.name).innerText = message.data
			break
		case 'matches':
			// TODO: Rewrite as sync, with fallthrough, in MV3.
			withActiveTab(tab => {
				if (tab.id === sender.tab!.id) {
					document.getElementById(message.name).innerText = message.data
				}
			})
			break
		case 'state':
			document.getElementById('state').innerText = message.data
			break
		case 'locator-validity':
			showValidity('locator', message.data)
			break
		default:
	}
})

chrome.storage.onChanged.addListener(changes => {
	if ('on' in changes) {
		// NOTE: Setting change could've come from keyboard command. This won't
		//       fire an event.
		document.getElementById('on').checked = changes.on.newValue
		reflectOnState(changes.on.newValue)
	}
})

document.getElementById('locator').addEventListener('keydown', event => {
	if (event.code === 'Enter') {
		withActiveTab(tab => chrome.tabs.sendMessage(tab.id!, { name: 'run' }))
	}
})

document.getElementById('reset').addEventListener('click', () => {
	for (const [ setting, value ] of typedEntries(defaults)) {
		if (setting === 'locator') continue
		const input = document.getElementById(setting)
		if (typeof value === 'boolean') {
			input.checked = value
		} else {
			input.value = value
		}
		input.dispatchEvent(new Event('change'))
	}
})

document.getElementById('help').addEventListener('click', () => {
	chrome.tabs.create({ url: 'https://github.com/matatk/element-highlighter/blob/main/README.md#element-highlighter' })
	window.close()
})

chrome.runtime.connect({ name: 'popup' })  // info will be sent eventually
