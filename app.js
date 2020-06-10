let win, userData = require('./config.json');

const {app, BrowserWindow, ipcMain } = require('electron')
	, requestLib = require('request-promise-native')
	, {createReadStream, writeFile} = require('fs')
	, saveConfig = () => writeFile('./config.json',  JSON.stringify(userData), 'utf8', () => {})
;

async function request(method = '', qs = {}) {
	qs.access_token = userData.token;
	qs.lang = userData.lang;
	qs.v = '5.103';
	let ans = await requestLib({method: "POST", uri: "https://api.vk.com/method/"+method, json: true, qs});
	return ans.response;
}

function getObjectFromQuery(query = '') {
	let result = {};
	query.split("&").forEach((part) => {
		let item = part.split("=");
		result[item[0]] = decodeURIComponent(item[1]);
	});
	return result;
}

app.on('ready', () => {
	win = new BrowserWindow({width: 700, height: 300, icon: __dirname + '/icon.png', show: false, webPreferences: {nodeIntegration: true}});
	win.resizable = false;
	win.removeMenu();
	win.once('ready-to-show', () => {if (userData.token) request('stats.trackVisitor');win.show();});
	win.on('closed', () => {win = null;});

	win.webContents.on('new-window', (e, url, fname, dis, opt) => {
		e.preventDefault();

		const modal = new BrowserWindow({parent: win, modal: true, webContents: opt.webContents, show: false});
		modal.once('ready-to-show', () => modal.show());

		modal.webContents.on('did-redirect-navigation', async (e, u) => {
			if (userData.token) {modal.close(); return;}
			if (!u.startsWith('https://oauth.vk.com/blank.html#')) return;

			u = getObjectFromQuery(u.slice(32));
			if (u.state !== 'magiclogin') return;

			userData.token = u.access_token;
			userData.id = u.user_id;

			request('stats.trackVisitor');

			modal.hide();

			userData.lang = (await request('account.getInfo', {fields: 'lang'})).lang;

			userData.uploadUrl = (await request('docs.getUploadServer', {type: 'graffiti'})).upload_url;
			userData.uploadUrlDoc = (await request('docs.getUploadServer')).upload_url;

			let user = await request('users.get', {user_ids: userData.id, fields: 'photo_50'});
			userData.firstName = user[0].first_name;
			userData.lastName = user[0].last_name;
			userData.avatar = user[0].photo_50;

			win.webContents.send('login', {firstName: userData.firstName, lastName: userData.lastName, avatar: userData.avatar});
			saveConfig();

			modal.close();
		});

		if (!opt.webContents) modal.loadURL(url);
		e.newGuest = modal;
	});

	ipcMain.on('isLogin', () => {
		if (userData.token) win.webContents.send('login', {firstName: userData.firstName, lastName: userData.lastName, avatar: userData.avatar});
	});

	ipcMain.on('logout', () => {
		userData = {};
		saveConfig();
		win.webContents.session.clearStorageData();
	});

	ipcMain.on('upload', async (e, data) => {
		try {
			let doc = await requestLib({method: "POST", uri: userData.uploadUrlDoc, json: true, formData: {file: createReadStream(data.path)}});
			doc.title = data.name;
			doc.tags = 'VkMagic:graffiti';
			let docComplete = await request('docs.save', doc);
			if (!docComplete) throw 'Access error';

			let file = await requestLib({method: "POST", uri: userData.uploadUrl, json: true, formData: {file: createReadStream(data.path)}});
			file.title = data.name;
			file.tags = 'VkMagic:graffiti';
			let fileComplete = await request('docs.save', file);
			if (!fileComplete) throw 'Access error';

			win.webContents.send('uploadAns', {status: 'OK', name: data.name});
		} catch (e) {
			win.webContents.send('uploadAns', {status: e, name: data.name});
		}
	});

	win.loadFile(__dirname + '/index.html');
});

app.on('window-all-closed', () => {app.quit();});