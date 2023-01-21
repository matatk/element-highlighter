import { defaults } from './settings.js'
import { withActiveTab } from './helpers.js'

import type { DataMessageName, DataType } from './messageTypes.js'

function sendToActiveTab<Name extends DataMessageName>(
	name: Name, data: DataType<Name>
): void {
	const message = data ? { name, data } : { name }
	withActiveTab(tab => {
		chrome.tabs.sendMessage(tab.id!, message)
	})
}

let isPopupOpen = false

chrome.runtime.onConnect.addListener(port => {
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
			chrome.browserAction.setBadgeText({ tabId: sender.tab!.id, text })
			break
		}
		case 'clear-badge':
			chrome.browserAction.setBadgeText({ tabId: sender.tab!.id, text: null })
			break
		case 'popup-open':
			sendResponse({ data: isPopupOpen })
			break
		default:
	}
})

chrome.commands.onCommand.addListener(command => {
	// TODO: Needed? (Assuming the action command wouldn't trigger this.)
	if (command === 'toggle-element-highlighter') {
		chrome.storage.sync.get({ on: defaults.on }, items => {
			chrome.storage.sync.set({ on: !items.on })
		})
	}
})
