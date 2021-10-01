/*	Main Process */
"use strict";

// Global Variable
var Conf = {};					// Config Praams
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = [
	"./baselist.html", "./data/config.json", './data/system.json', './data/overpass.json', `./data/marker.json`,
	`./data/category-${LANG}.json`, `data/list-${LANG}.json`, `./data/glot_custom.json`, `data/glot_system.json`];
const glot = new Glottologist();

// initialize
console.log("Welcome to MapMaker.");
window.addEventListener("DOMContentLoaded", function () {
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let arg = {}, basehtml = arguments[0][0];								// Get Menu HTML
		for (let i = 1; i <= 6; i++) arg = Object.assign(arg, arguments[i][0]);	// Make Config Object
		Object.keys(arg).forEach(key1 => {
			Conf[key1] = {};
			Object.keys(arg[key1]).forEach((key2) => Conf[key1][key2] = arg[key1][key2]);
		});
		glot.data = Object.assign(glot.data, arguments[7][0]);					// import glot data
		glot.data = Object.assign(glot.data, arguments[8][0]);					// import glot data

		window.onresize = winCont.window_resize;      	// 画面サイズに合わせたコンテンツ表示切り替え
		// document.title = glot.get("title");		// Title(no change / Google検索で日本語表示させたいので)
		cMapmaker.init(basehtml);					// Mapmaker Initialize
		if (Conf.google.Analytics !== "") {			// Google Analytics
			let AnalyticsURL = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + Conf.default.GoogleAnalytics + '"></script>';
			document.getElementsByTagName('head').insertAdjacentHTML("beforeend", AnalyticsURL);
			window.dataLayer = window.dataLayer || [];
			function gtag() { dataLayer.push(arguments); };
			gtag('js', new Date());
			gtag('config', Conf.google.Analytics);
		};
	});
});

class CMapMaker {

	constructor() {
		this.status = "initialize";
		this.open_osmid = "";
		this.last_modetime = 0;
	};

	init(basehtml) {	// Initialize
		winCont.window_resize();			// Set Window Size(mapidのサイズ指定が目的)
		winCont.splash(true);
		leaflet.init();						// Leaflet Initialize

		Promise.all([
			gSpreadSheet.get(Conf.google.AppScript),
			cMapmaker.static_check(),
			cMapmaker.poi_get()			// get_zoomなどleafletの情報が必要なためleaflet.init後に実行
		]).then(results => {
			// leaflet add control
			leaflet.controlAdd("bottomleft", "zoomlevel", "");
			leaflet.controlAdd("topleft", "baselist", basehtml, "leaflet-control m-1");	// Make: base list
			leaflet.controlAdd("bottomright", "global_spinner", "", "spinner-border text-primary d-none");
			leaflet.locateAdd();

			// mouse hover event(baselist mouse scroll)
			baselist.addEventListener("mouseover", () => { map.scrollWheelZoom.disable(); map.dragging.disable() }, false);
			baselist.addEventListener("mouseleave", () => { map.scrollWheelZoom.enable(); map.dragging.enable() }, false);

			poiCont.set_actjson(results[0]);
			cmap_events.init();
			cMapmaker.poi_view();
			winCont.window_resize();
			listTable.init();
			listTable.make(Object.values(Conf.list_targets));					// view all list
			cMapmaker.mode_change("map");										// initialize last_modetime
			winCont.menu_make(Conf.menu, "main_menu");
			glot.render();
			if (location.search !== "") {    	// 引数がある場合
				let search = location.search.replace(/[?&]fbclid.*/, '').replace(/%2F/g, '/');   // facebook対策
				let param = search.replace('-', '/').replace('=', '/').slice(1).split('.');
				history.replaceState('', '', location.pathname + search + location.hash);
				if (param[0] !== "") {
					cMapmaker.detail_view(param[0], param[1]);
				};
			};
			winCont.splash(false);
			console.log("cmapmaker: initial end.");
		});
	}

	static_check() {	// check static osm mode
		return new Promise((resolve, reject) => {
			if (!Conf.static.mode) {		// static mode以外は即終了
				resolve("no static mode");
			} else {
				$.ajax({ "type": 'GET', "dataType": 'json', "url": Conf.static.osmjson, "cache": false }).done(function (data) {
					let ovanswer = OvPassCnt.set_osmjson(data);
					poiCont.add_geojson(ovanswer);
					resolve(ovanswer);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log(statusText);
					reject(jqXHR, statusText, errorThrown);
				});;
			}
		})
	}

	licence() {			// About license
		let msg = { msg: glot.get("licence_message") + glot.get("more_message"), ttl: glot.get("licence_title") };
		winCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: winCont.modal_close, "menu": false });
	}

	mode_change(mode) {	// mode change(list or map)
		if (this.status !== "mode_change" && (this.last_modetime + 300) < Date.now()) {
			this.status = "mode_change";
			let params = { 'map': ['down', 'remove', 'start'], 'list': ['up', 'add', 'stop'] };
			mode = !mode ? (list_collapse.classList.contains('show') ? 'map' : 'list') : mode;
			console.log('mode_change: ' + mode + ' : ' + this.last_modetime + " : " + Date.now());
			list_collapse_icon.className = 'fas fa-chevron-' + params[mode][0];
			list_collapse.classList[params[mode][1]]('show');
			this.last_modetime = Date.now();
			this.status = "normal";
		};
	}

	poi_view() {			// Poiを表示させる
		console.log("cMapmaker: PoiView");
		if (map.getZoom() >= Conf.default.iconViewZoom) {
			Object.values(Conf.targets).forEach(key => Marker.set(key, false));
		} else if (map.getZoom() >= Conf.default.act_iconViewZoom) {
			Object.values(Conf.targets).forEach(key => Marker.set(key, true));
		} else {
			Marker.all_clear();
		};
	}

	poi_get(targets) {		// OSMとGoogle SpreadSheetからPoiを取得してリスト化
		return new Promise((resolve) => {
			console.log("cMapmaker: PoiGet start");
			winCont.spinner(true);
			var keys = (targets !== undefined && targets !== "") ? targets : Object.values(Conf.targets);
			if ((map.getZoom() < Conf.default.iconViewZoom) && !Conf.static.mode) {
				winCont.spinner(false);
				console.log("cMapmaker: poi_get end(more zoom).");
				resolve({ "update": false });
			} else {
				OvPassCnt.get(keys).then(ovanswer => {
					winCont.spinner(false);
					poiCont.add_geojson(ovanswer);
					console.log("cMapmaker: poi_get end(success).");
					resolve({ "update": true });
				}).catch((jqXHR) => {
					winCont.spinner(false);
					console.log("cMapmaker: poi_get end(overror). " + jqXHR.stack);
					resolve({ "update": false });
				});
			};
		});
	}

	qr_add(target, osmid) {			// QRコードを表示
		let marker = Marker.get(target, osmid);
		if (marker !== undefined) {
			let wiki = marker.mapmaker_lang.split(':');
			let url = encodeURI(`https://${wiki[0]}.${Conf.osm.wikipedia.domain}/wiki/${wiki[1]}`);
			let pix = map.latLngToLayerPoint(marker.getLatLng());
			let ll2 = map.layerPointToLatLng(pix);
			basic.getWikipedia(wiki[0], wiki[1]).then(text => Marker.qr_add(target, osmid, url, ll2, text));
		};
	}

	detail_view(osmid, openid) {	// PopUpを表示(marker,openid=actlst.id)
		let osmobj = poiCont.get_osmid(osmid);
		let tags = osmobj == undefined ? { "targets": [] } : osmobj.geojson.properties;
		let micon = tags.mapmaker_icon;
		let target = osmobj.targets[0];
		let category = poiCont.get_catname(tags);
		let title = "", message = "";
		for (let i = 0; i < Conf.osm[target].views.length; i++) {
			if (tags[Conf.osm[target].views[i]] !== void 0) {
				title = `<img src="./${Conf.icon.path}/${micon}">${tags[Conf.osm[target].views[i]]}`;
				break;
			}
		}
		if (title == "") title = category;
		if (title == "") title = glot.get("undefined");
		winCont.menu_make(Conf.detail_menu, "modal_menu");
		winCont.modal_progress(0);
		cMapmaker.open_osmid = osmid;

		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
		message += modal_osmbasic.make(tags);

		// append wikipedia
		if (tags.wikipedia !== undefined) {
			message += modal_wikipedia.element();
			winCont.modal_progress(100);
			modal_wikipedia.make(tags).then(html => {
				modal_wikipedia.set_dom(html);
				winCont.modal_progress(0);
			});
		};

		// append activity
		let actlists = poiCont.get_actlist(osmid);
		if (actlists.length > 0) message += modal_activities.make(actlists, openid);
		history.replaceState('', '', location.pathname + "?" + osmid + (!openid ? "" : "." + openid) + location.hash);
		winCont.modal_open({
			"title": title, "message": message, "mode": "close", "callback_close": () => {
				winCont.modal_close();
				history.replaceState('', '', location.pathname + location.hash);
				cMapmaker.open_osmid = "";
			}, "menu": true
		});
		if (openid !== undefined) document.getElementById("modal_" + openid).scrollIntoView();

		$('[data-toggle="popover"]').popover();			// set PopUp
	}

	url_share(openid) {			// URL共有機能
		function execCopy(string) {
			let pre = document.createElement('pre');			// ClipBord Copy
			pre.style.webkitUserSelect = 'auto';
			pre.style.userSelect = 'auto';
			let text = document.createElement("div");
			text.appendChild(pre).textContent = string;
			text.style.position = 'fixed';
			text.style.right = '200%';
			document.body.appendChild(text);
			document.getSelection().selectAllChildren(text);
			let copy = document.execCommand("copy");
			document.body.removeChild(text);
			return copy;
		};
		let osmid = location.search.replace(/[?&]fbclid.*/, '');    // facebook対策
		let param = osmid.replace('-', '%2F').replace('=', '%2F').slice(1).split('.');
		execCopy(location.protocol + "//" + location.hostname + location.pathname + "?" + param[0] + (!openid ? "" : "." + openid) + location.hash);
	}
};
var cMapmaker = new CMapMaker();

class cMapEvents {

	constructor() {
		this.busy = false;
		this.id = 0;
	}

	init() {
		map.on('moveend', () => cmap_events.map_move());   	// マップ移動時の処理
		map.on('zoomend', () => cmap_events.map_zoom());	// ズーム終了時に表示更新
	}

	map_move(e) {                					// map.moveend発生時のイベント
		console.log("cmapmaker: move event start.");
		if (this.busy > 1) return;					// 処理中の時は戻る
		if (this.busy == 1) clearTimeout(this.id);	// no break and cancel old timer.
		this.busy = 1;
		this.id = setTimeout(() => {
			console.log("cmapmaker: move event end.");
			this.busy = 2;
			cMapmaker.poi_get().then((status) => {
				cMapmaker.poi_view();
				if (status.update) listTable.datalist_make(Object.values(Conf.list_targets));	// view all list
				this.busy = 0;
			}).catch(() => {
				cMapmaker.poi_view();
				this.busy = 0;
			});
		}, 1000);
	}

	map_zoom() {				// View Zoom Level & Status Comment
		let nowzoom = map.getZoom();
		let message = `${glot.get("zoomlevel")}${map.getZoom()} `;
		if (nowzoom < Conf.default.iconViewZoom) message += `<br>${glot.get("morezoom")}`;
		$("#zoomlevel").html("<h2 class='zoom'>" + message + "</h2>");
	}
}
var cmap_events = new cMapEvents();
