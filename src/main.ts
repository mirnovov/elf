import { LinkCache, MarkdownView, Plugin, editorEditorField, editorViewField } from "obsidian";
import { RangeSet, RangeSetBuilder } from "@codemirror/rangeset";
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView, Decoration, DecorationSet, PluginValue, ViewUpdate, ViewPlugin } from "@codemirror/view";
import { DEFAULT, ElfSettingTab, ElfSettings  } from "./settings";
import { syntaxTree } from "@codemirror/language";
import { tokenClassNodeProp } from "@codemirror/stream-parser";

export default class EnhancedLivePreviewFeatures extends Plugin {	
	settings: ElfSettings;
	cmPlugin: ViewPlugin<ElfMirror>;
	
	async onload(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT, await this.loadData());
		this.addSettingTab(new ElfSettingTab(this.app, this));
		
		this.cmPlugin = ViewPlugin.define(
			v => new ElfMirror(this, v),
			{ decorations: v => v.decorations }
		);
		this.app.workspace.onLayoutReady(() => this.registerEditorExtension(this.cmPlugin));
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
	
	internalLink(destination: string): void {
		this.app.workspace.openLinkText(destination, "", false, { active: true });
	}
	
	externalLink(destination: string): void {
		window.open(destination, "_blank");
	}
	
	overridePointer(set: boolean): void {
		document.body.classList[set ? "add" : "remove"]("nv-override-pointer");
	}
	
	generateUid(): string {
		return Math.random().toString(36).substring(2);
	}
}

class Link {
	constructor(
		public uid: string, 
		public from: number, 
		public to: number, 
		public internal: boolean,
		public destination?: string,
		public unnamed?: boolean
	) {}
}

class ElfMirror implements PluginValue {
	decorations: DecorationSet;
	links: Map<String, Link> = new Map();
	done: Set<Element> = new Set();
	expanded: boolean = false;
	live: boolean = false;
	
	constructor(public plugin: EnhancedLivePreviewFeatures, view: EditorView) {
		this.switchMode(view.state);
		this.plugin.app.workspace.on("layout-change", () => this.switchMode(view.state));
		
		if (this.live) {
			this.registerLinks(view);
			this.addEventHandlers(view);
			setTimeout(() => this.unfocusEditor(view), 10);
		}
	}
	
	update(update: ViewUpdate): void {
		if (this.live && (update.docChanged || update.viewportChanged)) { 
			this.registerLinks(update.view);
		}
		if (this.live) {
			setTimeout(() => this.addEventHandlers(update.view), 10);
		}
	}
	
	destroy(): void {}
	
	switchMode(state: EditorState): void {
		const view = state.field(editorEditorField).state.field(editorViewField);
		const viewState = view.getState();
		this.live = viewState.mode == "source" && !viewState.source;
		
		if (this.plugin.settings.hideSwitch) {
			const button = view.containerEl.querySelector(".view-action:first-child") as HTMLElement;
			button.hidden = this.live;
		}
		
		if (!this.live) { this.decorations = new RangeSet<Decoration>(); }
	}
	
	unfocusEditor(view: EditorView): void {
		let doc = view.state.doc;
		
		//look for an empty line if possible to avoid markdown rendering stuff
		for (let i = 1; i <= doc.lines; i++) {
			let line = doc.line(i);
			if (line.text === "") { 
				view.dispatch({
					selection: EditorSelection.cursor(line.from), scrollIntoView: false 
				}); 
				break;
			}
		}
		
		this.plugin.app.workspace.getActiveViewOfType(MarkdownView).editor.blur();
	}
	
	onLinkHover = (link: Link, state: EditorState): void => {
		this.expanded = false;
		
		for (let sel of state.selection.ranges) {
			if (
				(sel.from >= link.from && sel.from <= link.to) || 
				(sel.to >= link.from && sel.to <= link.to)
			) this.expanded = true;
		}
		
		this.plugin.overridePointer(this.expanded);
	}
	
	onLinkClick = (link: Link, state: EditorState): void => {
		if (this.expanded) { return; }
		
		this.unfocusEditor(state.field(editorEditorField));
		this.plugin[link.internal ? "internalLink" : "externalLink"](link.destination);
	}
	
	registerLinks(view: EditorView): void {
		this.links.clear();
		this.done.clear();
		
		for (let link of this.getInternalLinks(view).values()) {
			const result = new Link(
				this.plugin.generateUid(),
				link.position.start.offset, 
				link.position.end.offset, 
				true,
				link.link
			);
			this.links.set(result.uid, result);
		}
		
		const builder = new RangeSetBuilder<Decoration>();
		let currentLink: Link = null;
		
		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({ from, to, enter: (type, from, to) => {
				const tokenProps = type.prop(tokenClassNodeProp);
				if (!tokenProps || tokenProps.contains("formatting")) { return; }
				
				const props = new Set(tokenProps.split(" "));
				const uid = this.plugin.generateUid();
				const content = view.state.doc.sliceString(from, to);
				
				if (props.has("url") && !content.match(/^https?\:\/\//)) {
					return;
				}
				else if (currentLink === null) {
					if (props.has("url")) {
						//bare url
						const url = view.state.doc.sliceString(from, to);
						const result = new Link(uid, from, to, false, url, true);
						this.links.set(result.uid, result);
					}
					else if (props.has("link")) {
						//start of link
						currentLink = new Link(uid, from, to, false);
					}
					
				}
				else if (props.has("link")) {
					//part of previous (eg. interrupted by escapes)
					currentLink.to = to;
				}
				else if (props.has("url")) {
					//end with url
					currentLink.destination = view.state.doc.sliceString(from, to);
					currentLink.to = to;
					this.links.set(currentLink.uid, currentLink);
					currentLink = null;
				}
			},
			});
		}
		
		Array.from(this.links.values()).sort((a, b) => a.from - b.from).forEach(link => {
			try {
				const attrs: any = { "data-nv-uid": link.uid };
				if (!link.internal && !link.unnamed) { 
					attrs["aria-label"] = link.destination; 
					attrs["aria-label-position"] = "top";
				}
				
				builder.add(link.from, link.to, Decoration.mark({ attributes: attrs }));
			} 
			catch (err) {
				console.error(err); throw err;
			}
		});
		
		this.decorations = builder.finish();
	}
	
	getInternalLinks(view: EditorView): LinkCache[] {
		try {
			return this.plugin.app.metadataCache.getFileCache(
				view.state.field(editorViewField).file
			)?.links || [];
		}
		catch (err) { return []; }
	}
	
	addEventHandlers(view: EditorView): void {
		//not managed by CodeMirror as we want plugin content etc. too
		view.dom.querySelectorAll(":where([data-href], [data-nv-uid]):not([data-nv-done])").forEach(el => {			
			let link = this.links.get(el.getAttribute("data-nv-uid"));
			
			if (!link) {
				link = new Link(
					this.plugin.generateUid(), -1, -1, 
					el.classList.contains("internal-link"), 
					el.getAttribute("data-href")
				);
				this.links.set(link.uid, link);
			}
			
			el.setAttribute("data-nv-done","");
			el.addEventListener("click", () => this.onLinkClick(link, view.state));
			el.addEventListener("mouseover", () => this.onLinkHover(link, view.state));
			el.addEventListener("mouseleave", () => this.plugin.overridePointer(true));
		});
	}
}
