'use strict'

// FIXME: DRY with popup.js
const withActiveTab = func => chrome.tabs.query(
	{ active: true, currentWindow: true }, tabs => func(tabs[0]))

const sendToActiveTab = (name, data) => withActiveTab(tab =>
	chrome.tabs.sendMessage(tab.id, { name, data }))

chrome.runtime.onConnect.addListener(function(port) {
	if (port.name === 'popup') {
		sendToActiveTab('popup-open', true)
		port.onDisconnect.addListener(function() {
			sendToActiveTab('popup-open', false)
		})
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'matches') {
		const text = message.data === 0 ? '' : String(message.data)
		chrome.browserAction.setBadgeText({ text })
	}
})
