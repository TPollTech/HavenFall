const RELEASE = {
  version: '1.7.0',
  fileName: 'HavenFall-Desktop-portable.exe',
  relativePath: 'downloads/HavenFall-Desktop-portable.exe'
};

function applyReleaseInfo() {
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) versionLabel.textContent = RELEASE.version;

  const links = document.querySelectorAll('a[href="downloads/HavenFall-Desktop-portable.exe"]');
  links.forEach(link => {
    link.href = RELEASE.relativePath;
    link.setAttribute('download', RELEASE.fileName);
  });
}

function warnIfOpenedWithoutDownload() {
  const isLocal = location.protocol === 'file:';
  const note = document.createElement('div');
  note.className = 'download-note';
  note.innerHTML = isLocal
    ? 'Página aberta localmente. Coloque o executável em <strong>site para download/downloads/</strong> para testar o botão de download.'
    : 'Baixe a versão mais recente do HavenFall Desktop para Windows.';
  document.querySelector('.hero-copy')?.appendChild(note);
}

applyReleaseInfo();
warnIfOpenedWithoutDownload();
