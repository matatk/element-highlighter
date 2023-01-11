'use strict'
// NOTE: Also in content.js
const settings = {
	'locator': null,
	'outline': '4px solid orange',
	'monitor': true,
	'landmarks': false
}

const changeHandler = (input, func) => input.addEventListener('change', func)

const withActiveTab = func => chrome.tabs.query(
	{ active: true, currentWindow: true }, tabs => func(tabs[0]))

chrome.storage.sync.get(settings, items => {
	for (const setting in settings) {
		const control = document.getElementById(setting)
		if (typeof settings[setting] === 'boolean') {
			control.checked = items[setting]
		} else {
			control.value = items[setting]
		}
	}
})

for (const setting in settings) {
	const control = document.getElementById(setting)
	if (setting === 'outline') {
		changeHandler(control, event => {
			if (event.target.value === '') event.target.value = settings.outline
			chrome.storage.sync.set({ [setting]: event.target.value })
		})
	} else if (typeof settings[setting] === 'boolean') {
		changeHandler(control, event => {
			chrome.storage.sync.set({ [setting]: event.target.checked })
		})
	} else {
		changeHandler(control, event => {
			chrome.storage.sync.set({ [setting]: event.target.value })
		})
	}
}

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
		case 'validity': {
			const input = message.of
			document.getElementById(`${input}-valid`).hidden = !message.data
			document.getElementById(`${input}-invalid`).hidden = message.data
			document.getElementById(input).setAttribute(
				'aria-invalid', !message.data)
			break
		}
		case 'state':
			document.getElementById('state').innerText = message.data
			break
		default:
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
