'use strict'
// NOTE: Also in content.js
const settings = {
	'locator': null,
	'outline': '2px solid orange',
	'boxShadow': 'inset 0 0 0 2px orange',
	'monitor': true,
	'landmarks': false,
	'landmarksAlwaysWrap': false,
	'tint': false,
	'color': 'orange',
	'opacity': '25%'
}

const cssSettings = ['outline', 'boxShadow', 'color', 'opacity']

const simpleChangeHandler =
	(input, func) => input.addEventListener('change', func)

const withActiveTab = func => chrome.tabs.query(
	{ active: true, currentWindow: true }, tabs => func(tabs[0]))

function isValidCss(property, proposed) {
	if (proposed === '') return null
	const test = document.createElement('div')
	test.style[property] = proposed
	const valid = test.style[property] !== ''
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
		case null: element.className = 'validity-empty'
			break
		default: throw Error(`Unexpected validity: "${validity}"`)
	}
	document.getElementById(setting).setAttribute(
		'aria-invalid', validity === false)
}

chrome.storage.sync.get(settings, items => {
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
					chrome.storage.sync.set({ [setting]: event.target.value })
				}
				showValidity(setting, validity)
			})
		} else {
			control.value = items[setting]

			simpleChangeHandler(control, event => {
				chrome.storage.sync.set({ [setting]: event.target.value })
			})
		}
	}
})

document.getElementById('locator').addEventListener('keydown', event => {
	if (event.code === 'Enter') {
		withActiveTab(tab => chrome.tabs.sendMessage(tab.id, { name: 'run' }))
	}
})

chrome.runtime.onMessage.addListener(message => {
	switch (message.name) {
		case 'mutations':
		case 'runs':
		case 'matches':
			document.getElementById(message.name).innerText = message.data
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

document.getElementById('reset').addEventListener('click', () => {
	for (const [setting, value] of Object.entries(settings)) {
		if (setting === 'locator') continue
		const input = document.getElementById(setting)
		if (typeof settings[setting] === 'boolean') {
			input.checked = value
		} else {
			input.value = value
			input.dispatchEvent(new Event('change'))
		}
	}
})

document.getElementById('help').addEventListener('click', () => {
	chrome.tabs.create({ url: 'https://github.com/matatk/element-highlighter/blob/main/README.md#element-highlighter' })
	window.close()
})

withActiveTab(tab => {
	if (tab.url.match(/^(?:https?|file):\/\//)) {
		chrome.tabs.sendMessage(tab.id, { name: 'get-info' })
	} else {
		for (const control of document.getElementsByTagName('input')) {
			control.disabled = true
		}
	}
})
