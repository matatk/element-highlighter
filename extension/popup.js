'use strict'
const KEY = 'selector'  // also in content.js
const ID = 'input'

document.getElementById(ID).addEventListener('change', event => {
	chrome.storage.sync.set({ [KEY]: event.target.value })
})

chrome.storage.sync.get([ KEY ], items => {
	if (items[KEY]) {
		document.getElementById(ID).value = items[KEY]
	}
})
