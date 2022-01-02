'use strict'
// NOTE: Also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid orange',
	'monitor-changes': true,
	'visual-only': false
}

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

const changeHandler = (input, func) => input.addEventListener('change', func)

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

function sendToActiveTab(message) {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, message)
	})
}

document.getElementById('selector').addEventListener('keydown', event => {
	if (event.code === 'Enter') sendToActiveTab({ name: 'run' })
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
	chrome.tabs.create({ url: chrome.runtime.getURL('README.html') })
	window.close()
})

sendToActiveTab({ name: 'get-info' })
