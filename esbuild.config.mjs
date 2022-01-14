import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";

const prod = (process.argv[2] === 'production');

esbuild.build({
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian", 
		"electron",
		"@codemirror/language",
		"@codemirror/rangeset",
		"@codemirror/state",
		"@codemirror/stream-parser",
		"@codemirror/text",
		"@codemirror/view", 
		...builtins
	],
	format: "cjs",
	watch: !prod,
	target: "es2016",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: (process.argv[2] != undefined && !prod) ? process.argv[2] : "out/main.js"
}).catch(e => { throw e });

if (prod) {
	["styles.css", "manifest.json"].forEach(file => {
		fs.copyFile(`./${file}`, `./out/${file}`, e => { if (e) throw e });
	});
}