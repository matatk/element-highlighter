Element Highlighter
===================

**Browser extension that highlights elements that match a CSS selector or an XPath—both visually, and optionally via landmark regions.**

This simple browser extension highlights all elements on the page that match a selector or XPath, using a CSS outline and/or box-shadow of your choice. It can also create a landmark region around each match, so that if you can't see the screen, prefer using the keyboard, or are otherwise using assistive technologies (such as a screen reader, or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/)), you can easily find the matching elements.

Your selector/XPath will run on all pages automatically. On Chromium-based browsers you will need to refresh any pages that are open when you first load the extension, though.

By default, whilst a query exists in the "Selector or XPath" input box, the page will be re-queried on any DOM change (this uses a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) behind the scenes). However, if there are subsequent mutations to the DOM within a two-second window, they will be ignored, and the page will be re-queried at the end of a further two-second window. This is intended to mitigate most performance concerns during active use. Some pages (often web apps or games) change a lot, though, so a checkbox is provided to turn off change monitoring entirely.

It is recommended to leave the selector/XPath box blank, or to engage manual mode, when you're not using the extension, to avoid wasting CPU time and energy.

Installing the extension
------------------------

First you need to either check out, or [download the code](https://github.com/matatk/element-highlighter/archive/refs/heads/main.zip). You can then sideload it manually in various browsers—point your browser at the `extension/` directory. Here are the instructions for some popular ones:

* **Firefox:** [Temporary installation in Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

* **Edge:** [Sideload an extension](https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)

* **Chrome:** [Load an unpacked extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/#unpacked)

**Notes:**

* For Firefox, it was necessary to specify an ID for the extension. This makes other browsers complain about non-standard manifest keys, but it doesn't affect functionality.

* If you have [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) installed you can use that to start it. Running `npm run start:firefox` or `npm run start:chrome` will open a blank test profile in either browser, with the extension installed, for quick testing.

Using the extension
-------------------

Activate the toolbar icon, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> (<kbd>Option</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> on Mac) to bring up the pop-up, where you can update your selector/XPath and tweak the outline/box-shadow style.

In the pop-up, you can also toggle the two checkboxes to control whether the page is automatically monitored, and whether landmark regions are placed around each match.

**Note:** Landmark regions are only discoverable via assistive technologies, such as screen readers or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/).

Landmark regions are added into the DOM to wrap the matched elements. The regions are labelled with a number corresponding to the element's order in the set of elements found, and they're given a region type of "Highlight".

Your chosen selector/XPath, outline and box-shadow style, and behavioural settings will be saved across browser restarts.

Keyboard workflow tips
----------------------

* Pressing <kbd>Return</kbd>/<kbd>Enter</kbd> or simply moving focus away from an input box will run the selector/XPath, or update the outline or box-shadow style, if the values have changed.

* In addition, if you're running in manual mode (where the page is not monitored for changes), pressing <kbd>Return</kbd>/<kbd>Enter</kbd> will re-run the selector/XPath, even if it hasn't changed.

* The pop-up stays open after you've entered/updated values, so you can keep refining your selector/XPath. Instead of pressing <kbd>Return</kbd>/<kbd>Enter</kbd> after inputting a new selector/XPath/outline/box-shadow, you can just press <kbd>Escape</kbd> and the pop-up will close, and the new value will be used.

Limitations
-----------

It's possible that, depending on the page's styling, the use of landmark regions can alter the visual presentation of the page. In extreme cases, it could interfere with the functionality, though this is expected to be very rare.

Only elements below the `<body>` will be counted as matches, and highlighted (for either type of query).

An XPath can return more than just an element, or elements, but only XPaths that return elements are supported.

The extension is forbidden from running on some pages. If you visit a built-in browser page (where the URL doesn't start with `https?://`) the pop-up's input controls will be disabled. However, the extension will also not run on the browser's extension store pages, and that is not detected by the pop-up.

Acknowledgements
----------------

[@TPGJRogers](https://github.com/TPGJRogers) for the idea of using landmarks to demarcate matches. We had talked about more amusing ideas, such as playing sounds when entering/leaving matching elements, but that would've required code running within the user's assistive technology.

MDN and StackOverflow for help, as ever.
