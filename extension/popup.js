'use strict'
// NOTE: Also in content.js
const settings = {
	'on': true,
	'announce': false,
	'locator': null,
	'drawOutline': true,
	'outline': '2px solid orange',
	'drawBoxShadow': true,
	'boxShadow': 'inset 0 0 0 2px orange',
	'drawTint': false,
	'color': 'orange',
	'opacity': '25%',
	'monitor': true,
	'landmarks': false,
	'landmarksAlwaysWrap': false
}

const cssSettings = ['outline', 'boxShadow', 'color', 'opacity']

const simpleChangeHandler =
	(input, func) => input.addEventListener('change', func)

// FIXME: DRY with background.js
const withActiveTab = func => chrome.tabs.query(
	{ active: true, currentWindow: true }, tabs => func(tabs[0]))

function isValidCss(property, proposed) {
	if (proposed === '') return false
	const test = document.createElement('div')
	test.style[property] = proposed
	const valid = test.style[property] !== ''  // NOTE: Good enough, prob :-)
	test.remove()
	return valid
}

function showValidity(setting, validity) {
	const element = document.getElementById(`${setting}-validity`)
	switch (validity) {
		case true: element.className = 'validity-valid'
			break
		case false: element.className = 'validity-invalid'
			break
		default: throw Error(`Unexpected validity: "${validity}"`)
	}
	document.getElementById(setting).setAttribute(
		'aria-invalid', validity === false)
}

function reflectOnState(onState) {
	const onCheckbox = document.getElementById('on')
	const disabledState = !onState
	for (const control of document.querySelectorAll('input')) {
		if (control !== onCheckbox) control.disabled = disabledState
	}
	if (onState) document.getElementById('locator').focus()
}

chrome.storage.sync.get(settings, items => {
	reflectOnState(items.on)
	document.getElementById(items.on ? 'locator' : 'on').focus()

	for (const setting in settings) {
		const control = document.getElementById(setting)
		if (typeof settings[setting] === 'boolean') {
			control.checked = items[setting]

			simpleChangeHandler(control, event => {
				chrome.storage.sync.set({ [setting]: event.target.checked })
			})
		} else if (cssSettings.includes(setting)) {
			control.value = items[setting]

			showValidity(setting, isValidCss(setting, control.value))
			control.addEventListener('change', event => {
				const validity = isValidCss(setting, event.target.value)
				if (validity !== false) {
					chrome.storage.sync.set({ [setting]: event.target.value.trim() })
				}
				showValidity(setting, validity)
			})
		} else {
			control.value = items[setting]

			simpleChangeHandler(control, event => {
				chrome.storage.sync.set({ [setting]: event.target.value.trim() })
			})
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
				if (tab.id === sender.tab.id) {
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

chrome.storage.onChanged.addListener((changes) => {
	if ('on' in changes) {
		// NOTE: Setting change could've come from keyboard command. This won't
		//       fire an event.
		document.getElementById('on').checked = changes.on.newValue
		reflectOnState(changes.on.newValue)
	}
})

document.getElementById('locator').addEventListener('keydown', event => {
	if (event.code === 'Enter') {
		withActiveTab(tab => chrome.tabs.sendMessage(tab.id, { name: 'run' }))
	}
})

document.getElementById('reset').addEventListener('click', () => {
	for (const [setting, value] of Object.entries(settings)) {
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
