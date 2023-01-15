'use strict'

// FIXME: DRY with popup.js
const withActiveTab = func => chrome.tabs.query(
	{ active: true, currentWindow: true }, tabs => func(tabs[0]))

const sendToActiveTab = (name, data) => withActiveTab(tab =>
	chrome.tabs.sendMessage(tab.id, { name, data }))

let isPopupOpen = false

chrome.runtime.onConnect.addListener(function(port) {
	if (port.name === 'popup') {
		isPopupOpen = true
		sendToActiveTab('popup-open', true)
		port.onDisconnect.addListener(function() {
			isPopupOpen = false
			sendToActiveTab('popup-open', false)
		})
	}
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.name) {
		case 'matches': {
			const text = message.data === 0 ? '' : String(message.data)
			chrome.browserAction.setBadgeText({ tabId: sender.tab.id, text })
			break
		}
		case 'popup-open':
			sendResponse({ name: 'popup-open', data: isPopupOpen })
			break
		default:
	}
})
