'use strict'
chrome.commands.onCommand.addListener(name => {
	chrome.storage.sync.get('selector', items => {
		if (name === 'update-highlights') {
			chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
				chrome.tabs.sendMessage(tabs[0].id, { name })
			})
		}
	})
})
