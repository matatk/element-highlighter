Highlight Selector
==================

This simple browser extension highlights all elements on the page that match a selector (using a CSS outline of your choice), and creates a landmark region for each match (so that people who can't see the screen and are using assistive technologies can find the matches, and so that people using the keyboard and [Landmarks extension](https://matatk.agrip.org.uk/landmarks/) to navigate can easily move between them).

If an element that matches the selector already _is_ a landmark region, it's wrapped with a new one (which is removed when the selector is changed).

Please note that this will run on all pages automatically, but does not presently update the highlights as the DOM changes. You can use the re-run button or keyboard shortcut to update the highlights at any time.

Running the extension
---------------------

If you have [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) installed you can use that to start it. You can also sideload it manually in various browsers; here are the instructions for some popular ones:

* **Firefox:** [Temporary installation in Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
* **Edge:** [Sideload an extension](https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)
* **Chrome:** [Instructions in the "Create the manifest" section of the "Getting started" docs](https://developer.chrome.com/extensions/getstarted#manifest)
* **Opera:** [Testing and Debugging](https://dev.opera.com/extensions/testing/)

**Note:** In order to make it work on Firefox, it was necessary to specify an ID for the extension. This makes other browsers complain about non-standard manifest keys, but it doesn't affect functionality.

Using the extension
-------------------

Activate the toolbar icon, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> (<kbd>Option</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> on Mac) to bring up the pop-up, where you can update your selector and tweak the outline style.

Your chosen selector and outline styles will be saved across browser restarts.

Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> (<kbd>Option</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> on Mac) to re-run the current selector at any time (even if the pop-up is closed).

### Quick keyboard workflow tips

Pressing <kbd>Return</kbd>/<kbd>Enter</kbd> will run the selector, or update the outline style, if the values have changed. Making the selector blank will disable highlighting. If you enter a blank outline style, the default style will come back.

The pop-up stays open after you've entered new values, so you can keep re-running selectors. Instead of pressing <kbd>Return</kbd>/<kbd>Enter</kbd> after inputting a new selector/outline, you can just press <kbd>Escape</kbd> and the pop-up will close, with the new values reflected.
