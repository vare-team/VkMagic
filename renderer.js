const { ipcRenderer, shell } =  require('electron');

document.getElementsByName('externalLink').forEach(el => {
	el.onclick = function (e) {
		e.preventDefault();
		shell.openExternal(this.href);
	};
});

document.getElementById('logout').onclick = () => {
	ipcRenderer.send('logout');
	document.getElementById("modal").style.display = "block";
	document.getElementById("name").innerText = '';
	document.getElementById('avatar').src = 'whooves.png';
};

document.getElementById('fileUpload').onclick = () => {
	let file = document.getElementById('file').files[0];
	ipcRenderer.send('upload', {name: file.name.slice(0, -4), path: file.path});
};

ipcRenderer.on('uploadAns', (e, data) => {alert(`File: ${data.name}\nStatus: ${data.status}`);});

ipcRenderer.send('isLogin');

ipcRenderer.on('login', (e, data) => {
	document.getElementById("modal").style.display = "none";
	document.getElementById("name").innerText = data.firstName + ' ' + data.lastName;
	document.getElementById('avatar').src = data.avatar;
});

let link = document.getElementsByClassName('TabButtonWork');
let tab  = document.getElementsByClassName('Tab');
for( let i = 0; i < link.length; i++ ){
	link[i].addEventListener('click', function(){
		for( let u = 0; u < link.length; u++ ){
			link[u].classList.remove('active');
			tab[u].style.display = 'none';
		}
		this.classList.add('active');
		tab[i].style.display = 'block';
	});
}
