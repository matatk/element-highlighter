export function withActiveTab(func: (result: chrome.tabs.Tab) => void) {
	chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
		func(tabs[0])
	})
}
