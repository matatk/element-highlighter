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

chrome.storage.sync.get(settings, items => {
	for (const setting in settings) {
		if (items[setting]) {
			document.getElementById(setting).value = items[setting]
		}
	}
})
