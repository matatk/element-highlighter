'use strict'
// also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}

for (const setting in settings) {
	document.getElementById(setting).addEventListener('change', event => {
		if (setting === 'outline' && event.target.value === '') {
			event.target.value = settings.outline
		}
		chrome.storage.sync.set({ [setting]: event.target.value })
	})
}

document.getElementById('rerun').addEventListener('click', () => {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, { name: 'update-highlights' })
	})
})

chrome.storage.sync.get(settings, items => {
	for (const setting in settings) {
		if (items[setting]) {
			document.getElementById(setting).value = items[setting]
		}
	}
})
