<p align="center"><img width="375" height="187" alt="ELF - Enhanced Live Preview" src="media/elf.png"></p>
<p align="center">
Incorporates limited Reading View functionality into <a href="https://obsidian.md">Obsidian</a>'s Live Preview mode, allowing you to use it for both reading and editing.
</p>
<br>
<p align="center"><img src="media/demo.gif"></p>

Currently, behavior supported in Live Preview includes:

* Some link interactions (including clicking without holding down Ctrl/Cmd). Links can still be edited when the cursor is within their bounds.
* Minor rendering changes to appear visually closer to Reading mode.
* Unfocusing on note open. This also includes deselecting text where possible so it doesn't show the Markdown syntax.

This plugin is somewhat experimental - due to the workarounds that are used to make this plugin function, maximum compatibilty is not guaranteed. Nevertheless, if you experience problems, please report it as an issue.

### Installation

You can either obtain the plugin using Obsidian's built-in browser, or install it manually by putting it in your vault's `.obsidian/plugins` folder. If doing the latter, you'll need to run `npm i` in the plugin directory to initialise the npm package and download required sources. Then execute `npm run build`, which will compile the package's TypeScript files into JavaScript.
