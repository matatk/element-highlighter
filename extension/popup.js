'use strict'
// NOTE: Also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}

chrome.storage.sync.get(settings, items => {
	for (const setting in settings) {
		if (items[setting]) {
			document.getElementById(setting).value = items[setting]
		}
	}
})

for (const setting in settings) {
	document.getElementById(setting).addEventListener('change', event => {
		if (setting === 'outline' && event.target.value === '') {
			event.target.value = settings.outline
		}
		chrome.storage.sync.set({ [setting]: event.target.value })
	})
}

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'mutations' || message.name === 'matches') {
		document.getElementById(message.name).innerText =
			message.data >= 0 ? message.data : '\u2014'
	} else if (message.name === 'validity') {
		document.getElementById(`${message.of}-valid`).hidden = !message.data
		document.getElementById(`${message.of}-invalid`).hidden = message.data
		document.getElementById(message.of).setAttribute(
			'aria-invalid', !message.data)
	}
})

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
	chrome.tabs.sendMessage(tabs[0].id, { name: 'get-info' })
})

document.getElementById('help').addEventListener('click', () => {
	chrome.tabs.create({ url: chrome.runtime.getURL('README.html') })
	window.close()
})
