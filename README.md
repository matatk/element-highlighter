Highlight Selector
==================

**Browser extension that highlights elements on the page that match a selector.**

This simple browser extension highlights all elements on the page that match a selector, using a CSS outline of your choice. It can also create a landmark region around each match, so that if you can't see the screen, prefer using the keyboard, or are otherwise using assistive technologies (such as a screen reader, or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/)), you can easily find the matching elements.

Your selector will run on all pages automatically. On Chromium-based browsers you will need to refresh any pages that are open when you first load the extension, though.

By default, whilst a query exists in the "selector" input box, the page will be re-queried on any DOM change (this uses a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) behind the scenes). However, if there are subsequent mutations to the DOM within a two-second window, they will be ignored, and the page will be re-queried at the end of a further two-second window. This is intended to mitigate most performance concerns during active use. Some pages (often web apps or games) change a lot, though, so a checkbox is provided to turn off change monitoring entirely.

It is recommended to leave the selector box blank, or to engage manual mode, when you're not using the extension, to avoid wasting CPU time and energy.

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

In the pop-up, you can also toggle the two checkboxes to control whether the page is automatically monitored, and whether landmark regions are placed around each match. These settings, too, will be saved.

**Note:** Landmark regions are only discoverable via assistive technologies, such as screen readers or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/).

Keyboard workflow tips
----------------------

* Pressing <kbd>Return</kbd>/<kbd>Enter</kbd> or simply moving focus away from an input box will run the selector, or update the outline style, if the values have changed.

* In addition, if you're running in manual mode (where the page is not monitored for changes), pressing <kbd>Return</kbd>/<kbd>Enter</kbd> will re-run the selector even if it hasn't changed.

* Making the selector blank will disable highlighting. If you enter a blank outline style, the default style will come back.

* The pop-up stays open after you've entered/updated values, so you can keep refining your selector. Instead of pressing <kbd>Return</kbd>/<kbd>Enter</kbd> after inputting a new selector/outline, you can just press <kbd>Escape</kbd> and the pop-up will close, and the new value will be used.

Limitations
-----------

It's possible that, depending on the page's styling, the use of landmark regions will alter the visual presentation of the page.

Acknowledgements
----------------

Jeremiah Rogers for the idea of using landmarks to demarcate matches. We had talked about more amusing but unfortunately unimplementable (due to the need to track assistive technologies' virtual cursors) ideas, such as playing sounds when entering/leaving matching elements, but landmarks are more robust, and less invasive.

MDN and StackOverflow for help as ever.
