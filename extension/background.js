'use strict'
chrome.commands.onCommand.addListener(name => {
	if (name === 'update-highlights') {
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			chrome.tabs.sendMessage(tabs[0].id, { name })
		})
	}
})
